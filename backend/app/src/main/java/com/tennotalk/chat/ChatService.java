package com.tennotalk.chat;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.tennotalk.chat.ChatDtos.ConversationDto;
import com.tennotalk.chat.ChatDtos.ConversationMemberDto;
import com.tennotalk.chat.ChatDtos.MessageDto;
import com.tennotalk.chat.ChatEvents.MessageCreated;
import com.tennotalk.chat.ChatEvents.MessageUpdated;
import com.tennotalk.chat.ChatEvents.ReactionChanged;
import com.tennotalk.chat.ChatEvents.ReceiptChanged;
import com.tennotalk.chat.ChatInputs.SendMessage;
import com.tennotalk.common.ApiException;
import com.tennotalk.common.Cursor;
import com.tennotalk.common.Ids;
import com.tennotalk.common.PageDto;
import com.tennotalk.common.Presence;
import com.tennotalk.media.MediaRepository;
import com.tennotalk.media.MediaRow;
import com.tennotalk.translation.MessageTranslationRepository;
import com.tennotalk.translation.TranslationJobRepository;
import com.tennotalk.users.PreferencesRepository;
import com.tennotalk.users.SocialGraph;
import com.tennotalk.users.UserRepository;
import com.tennotalk.users.UserRow;

@Service
public class ChatService {

    private static final int PAGE_SIZE = 30;
    private static final Instant FOREVER = Instant.parse("9999-12-31T23:59:59Z");

    private final ChatRepository chat;
    private final ChatProjector projector;
    private final UserRepository users;
    private final PreferencesRepository preferences;
    private final SocialGraph graph;
    private final MediaRepository media;
    private final MessageTranslationRepository translations;
    private final TranslationJobRepository jobs;
    private final Presence presence;
    private final ApplicationEventPublisher events;
    private final Clock clock;
    private final MessageReceipts receipts;
    private final com.tennotalk.notifications.NotificationService notifications;

    public ChatService(ChatRepository chat, ChatProjector projector, UserRepository users, PreferencesRepository preferences,
            SocialGraph graph, MediaRepository media, MessageTranslationRepository translations, TranslationJobRepository jobs,
            Presence presence, ApplicationEventPublisher events, Clock clock, MessageReceipts receipts, com.tennotalk.notifications.NotificationService notifications) {
        this.chat = chat;
        this.projector = projector;
        this.users = users;
        this.preferences = preferences;
        this.graph = graph;
        this.media = media;
        this.translations = translations;
        this.jobs = jobs;
        this.presence = presence;
        this.events = events;
        this.clock = clock;
        this.receipts = receipts;
        this.notifications = notifications;
    }

    // ---- reading ---------------------------------------------------------

    /** Listing is read-only; delivery requires a client acknowledgement. */
    @Transactional
    public List<ConversationDto> conversations(UUID viewer) {
        List<ConversationRow> rows = chat.conversationsOf(viewer);
        return project(viewer, rows);
    }

    @Transactional(readOnly = true)
    public ConversationDto conversation(UUID viewer, UUID conversationId) {
        return project(viewer, List.of(requireMember(conversationId, viewer))).getFirst();
    }

    @Transactional
    public PageDto<MessageDto> messages(UUID viewer, UUID conversationId, String cursor) {
        ConversationRow conversation = requireMember(conversationId, viewer);
        List<MessageRow> newestFirst = chat.pageBefore(conversationId, Cursor.decodeOrNull(cursor), PAGE_SIZE + 1);
        boolean more = newestFirst.size() > PAGE_SIZE;
        List<MessageRow> page = new ArrayList<>(more ? newestFirst.subList(0, PAGE_SIZE) : newestFirst);
        java.util.Collections.reverse(page);
        ChatProjector.Scope scope = scope(conversation);
        String next = more ? new Cursor(page.getFirst().createdAt(), page.getFirst().id()).encode() : null;
        return new PageDto<>(projector.many(viewer, page, Map.of(conversationId, scope)), next);
    }

    // ---- sending ---------------------------------------------------------

    @Transactional
    public MessageDto send(UUID viewer, UUID conversationId, SendMessage input) {
        return send(viewer, conversationId, input, null);
    }

    /** Also used for story replies (PLAN.md §9.9). Idempotent by clientId (PLAN.md §13). */
    @Transactional
    public MessageDto send(UUID viewer, UUID conversationId, SendMessage input, UUID storyId) {
        ConversationRow conversation = requireMember(conversationId, viewer);
        Optional<MessageRow> existing = chat.findByClientId(viewer, input.clientId());
        if (existing.isPresent()) {
            if (!existing.get().conversationId().equals(conversationId)) throw ApiException.conflict("This message id was already used.");
            return projector.one(viewer, existing.get(), scope(conversation));
        }
        UserRow sender = users.require(viewer);
        String text = input.text() == null || input.text().isBlank() ? null : input.text().strip();
        List<UUID> mediaIds = input.mediaIds() == null ? List.of() : List.copyOf(new LinkedHashSet<>(input.mediaIds()));
        List<MediaRow> attachments = orderedOwnedMedia(viewer, mediaIds);
        String type = storyId != null ? "story_reply" : typeOf(attachments);
        if (text == null && attachments.isEmpty()) throw ApiException.validation("A message can't be empty.");
        if (storyId != null && text == null) throw ApiException.validation("A reply can't be empty.");
        if (input.replyToId() != null) {
            chat.findMessage(input.replyToId())
                    .filter(quoted -> quoted.conversationId().equals(conversationId))
                    .orElseThrow(() -> ApiException.validation("You can only reply to a message of this conversation."));
        }

        MessageRow message;
        try {
            message = chat.insertMessage(Ids.newId(), conversationId, viewer, input.clientId(), type, text,
                    sender.nativeLanguage(), input.replyToId(), storyId);
        } catch (DuplicateKeyException race) {
            MessageRow raced = chat.findByClientId(viewer, input.clientId()).orElseThrow(() -> race);
            return projector.one(viewer, raced, scope(conversation));
        }
        chat.attachMedia(message.id(), attachments.stream().map(MediaRow::id).toList());
        afterInsert(message);
        return projector.one(viewer, message, scope(conversation));
    }

    private void afterInsert(MessageRow message) {
        ConversationRow conversation = chat.findConversation(message.conversationId()).orElseThrow();
        if ("direct".equals(conversation.kind())) {
            UUID recipient = chat.members(conversation.id()).stream().map(member -> member.user().id())
                .filter(id -> !id.equals(message.senderId())).findFirst().orElseThrow();
            requireDirectSendAllowed(message.senderId(), recipient);
        }
        receipts.snapshot(message);
        for (MemberRow member : chat.members(message.conversationId())) {
            if (member.mutedUntil() != null && member.mutedUntil().isAfter(clock.instant())) continue;
            notifications.notify(member.user().id(), message.senderId(), "new_message",
                new com.tennotalk.notifications.NotificationService.Target(null, null, null, null, message.conversationId(), message.id()));
        }
        chat.touch(message.conversationId(), message.createdAt());
        chat.advanceCursor(message.conversationId(), message.senderId(), message.id(), true);
        if (message.originalText() != null) {
            // Same rule as the projection: the language each member has at the moment of sending.
            List<MemberRow> members = chat.members(message.conversationId());
            ReceivingLanguages history = chat.receivingLanguages(userIds(members));
            List<String> languages = members.stream().map(member -> history.of(member, message.createdAt())).toList();
            for (String target : TranslationTargets.compute(message.originalLanguage(), languages)) {
                translations.insertPending(message.id(), target);
                jobs.enqueue("message", message.id(), target, clock.instant(), true);
            }
        }
        events.publishEvent(new MessageCreated(message.conversationId(), message.id()));
    }

    private List<MediaRow> orderedOwnedMedia(UUID viewer, List<UUID> ids) {
        if (ids.isEmpty()) return List.of();
        Map<UUID, MediaRow> owned = new HashMap<>();
        media.findOwned(viewer, ids).forEach(row -> owned.put(row.id(), row));
        if (owned.size() != ids.size()) throw ApiException.validation("Some attachments were not found.");
        return ids.stream().map(owned::get).toList();
    }

    static String typeOf(List<MediaRow> attachments) {
        if (attachments.isEmpty()) return "text";
        boolean allImages = attachments.stream().allMatch(m -> "image".equals(m.kind()));
        if (allImages) return "image";
        if (attachments.size() > 1) throw ApiException.validation("Send videos and files one at a time.");
        return "video".equals(attachments.getFirst().kind()) ? "video" : "file";
    }

    // ---- receipts, reactions, forward, mute -------------------------------

    /**
     * In a direct conversation with a block either way, receipts don't pass (PLAN.md §31.1): reading or receiving
     * still clears the reader's own unread count, but leaves no "delivered"/"read" mark on the other's messages.
     */
    private boolean receiptsHidden(ConversationRow conversation, UUID viewer) {
        if (!"direct".equals(conversation.kind())) return false;
        return chat.members(conversation.id()).stream().map(member -> member.user().id())
                .anyMatch(other -> !other.equals(viewer) && graph.blockedEitherWay(viewer, other));
    }

    @Transactional
    public void markRead(UUID viewer, UUID conversationId, UUID messageId) {
        ConversationRow conversation = requireMember(conversationId, viewer);
        chat.findMessage(messageId)
                .filter(message -> message.conversationId().equals(conversationId))
                .orElseThrow(() -> ApiException.notFound("Message not found."));
        if (!receiptsHidden(conversation, viewer)) {
            for (UUID id : receipts.read(viewer, conversationId, messageId)) events.publishEvent(new MessageUpdated(conversationId, id));
        }
        notifications.readConversation(viewer, conversationId, messageId);
        if (chat.advanceCursor(conversationId, viewer, messageId, true)) {
            events.publishEvent(new ReceiptChanged(conversationId, viewer, "read", messageId));
        }
    }

    @Transactional
    public void acknowledge(UUID viewer, UUID conversationId, List<UUID> messageIds) {
        ConversationRow conversation = requireMember(conversationId, viewer);
        boolean hidden = receiptsHidden(conversation, viewer);
        for (UUID id : messageIds) {
            MessageRow message = chat.findMessage(id).filter(m -> m.conversationId().equals(conversationId))
                .orElseThrow(() -> ApiException.notFound("Message not found."));
            if (!hidden && !message.senderId().equals(viewer) && receipts.delivered(viewer, id)) {
                events.publishEvent(new MessageUpdated(conversationId, id));
            }
        }
    }

    @Transactional
    public MessageDto react(UUID viewer, UUID messageId, String emoji) {
        MessageRow message = chat.findMessage(messageId).orElseThrow(() -> ApiException.notFound("Message not found."));
        ConversationRow conversation = requireMember(message.conversationId(), viewer);
        String clean = emoji.strip();
        if (clean.isEmpty()) throw ApiException.validation("Choose an emoji.");
        boolean added = chat.toggleReaction(messageId, viewer, clean);
        events.publishEvent(new ReactionChanged(message.conversationId(), messageId, viewer, clean, added));
        events.publishEvent(new MessageUpdated(message.conversationId(), messageId));
        return projector.one(viewer, message, scope(conversation));
    }

    @Transactional
    public void forward(UUID viewer, UUID messageId, List<UUID> conversationIds) {
        MessageRow source = chat.findMessage(messageId).orElseThrow(() -> ApiException.notFound("Message not found."));
        requireMember(source.conversationId(), viewer);
        List<UUID> mediaIds = media.forMessages(List.of(source.id())).getOrDefault(source.id(), List.of()).stream()
                .map(MediaRow::id).toList();
        String type = "story_reply".equals(source.type()) ? "text" : source.type();
        for (UUID target : new LinkedHashSet<>(conversationIds)) {
            requireMember(target, viewer);
            MessageRow copy = chat.insertMessage(Ids.newId(), target, viewer, "fwd-" + Ids.newId(), type,
                    source.originalText(), source.originalLanguage(), null, null);
            chat.attachMedia(copy.id(), mediaIds);
            afterInsert(copy);
        }
    }

    @Transactional
    public ConversationDto mute(UUID viewer, UUID conversationId, boolean muted) {
        ConversationRow conversation = requireMember(conversationId, viewer);
        chat.setMuted(conversationId, viewer, muted ? FOREVER : null);
        return project(viewer, List.of(conversation)).getFirst();
    }

    // ---- starting conversations ------------------------------------------

    static String directKey(UUID a, UUID b) {
        return a.compareTo(b) < 0 ? a + ":" + b : b + ":" + a;
    }

    /** Direct conversation, honoring blocks and "who can message me" (enforced here, PLAN.md §31.1). */
    @Transactional
    public ConversationDto direct(UUID viewer, UUID target) {
        if (viewer.equals(target)) throw ApiException.validation("You can't message yourself.");
        UserRow other = users.findById(target).filter(UserRow::onboarded).orElseThrow(() -> ApiException.notFound("User not found."));
        graph.lockPair(viewer, target);
        SendRestriction restriction = directRestriction(viewer, other.id(), preferences.whoCanMessageForShare(target));
        // An existing conversation stays reachable (its history, the reason in place of the composer) unless blocked.
        String key = directKey(viewer, target);
        Optional<UUID> existing = chat.findDirect(key);
        boolean blocked = restriction == SendRestriction.YOU_BLOCKED || graph.hasBlocked(target, viewer);
        if (existing.isPresent() && !blocked) return conversation(viewer, existing.get());
        if (restriction != null) throw ApiException.forbidden(restriction.message());
        UUID id = Ids.newId();
        chat.insertConversation(id, "direct", null, viewer, key);
        chat.addMember(id, viewer, "admin");
        chat.addMember(id, target, "member");
        return conversation(viewer, id);
    }

    /** Groups: each person creates at most one (PLAN.md §34), also guarded by a unique index. */
    @Transactional
    public ConversationDto createGroup(UUID viewer, String title, List<UUID> memberIds) {
        String clean = title == null ? "" : title.strip();
        if (clean.isEmpty()) throw ApiException.validation("Give the group a name.");
        List<UUID> others = memberIds.stream().distinct().filter(id -> !id.equals(viewer)).toList();
        if (others.size() < 2) throw ApiException.validation("Add at least two people to the group.");
        for (UUID member : others) {
            UserRow user = users.findById(member).filter(UserRow::onboarded).orElseThrow(() -> ApiException.validation("Some people were not found."));
            // Adding someone to a group is messaging them: their "Who can message me" applies (PLAN.md §31.1).
            if (directRestriction(viewer, user.id(), preferences.whoCanMessage(user.id())) != null)
                throw ApiException.validation("Some people can't be added.");
        }
        UUID id = Ids.newId();
        try {
            chat.insertConversation(id, "group", clean, viewer, null);
        } catch (DuplicateKeyException exception) {
            throw ApiException.conflict("You can create only one group.");
        }
        chat.addMember(id, viewer, "admin");
        others.forEach(member -> chat.addMember(id, member, "member"));
        return conversation(viewer, id);
    }

    // ---- helpers ---------------------------------------------------------

    public ConversationRow requireMember(UUID conversationId, UUID viewer) {
        ConversationRow conversation = chat.findConversation(conversationId)
                .orElseThrow(() -> ApiException.notFound("Conversation not found."));
        if (!chat.isMember(conversationId, viewer)) throw ApiException.forbidden("You are not a member of this conversation.");
        return conversation;
    }

    public ChatProjector.Scope scope(ConversationRow conversation) {
        List<MemberRow> members = chat.members(conversation.id());
        return new ChatProjector.Scope(conversation.kind(), members, chat.receivingLanguages(userIds(members)));
    }

    private void requireDirectSendAllowed(UUID sender, UUID recipient) {
        graph.lockPair(sender, recipient);
        SendRestriction restriction = directRestriction(sender, recipient, preferences.whoCanMessageForShare(recipient));
        if (restriction != null) throw ApiException.forbidden(restriction.message());
    }

    /**
     * Why {@code sender} can't message {@code recipient} directly, or null (PLAN.md §31.1). "People I follow" also
     * accepts someone the recipient asked to follow: the pending request already shows the recipient's interest.
     * {@code audience} is the recipient's "Who can message me", read with a lock when sending.
     */
    SendRestriction directRestriction(UUID sender, UUID recipient, String audience) {
        if (graph.hasBlocked(sender, recipient)) return SendRestriction.YOU_BLOCKED;
        if (graph.hasBlocked(recipient, sender) || "nobody".equals(audience)) return SendRestriction.UNAVAILABLE;
        if ("followers".equals(audience) && !graph.follows(recipient, sender) && !graph.requested(recipient, sender))
            return SendRestriction.FOLLOWERS_ONLY;
        return null;
    }

    private String sendRestriction(UUID viewer, String kind, List<MemberRow> members) {
        if (!"direct".equals(kind)) return null;
        return members.stream().map(m -> m.user().id()).filter(id -> !id.equals(viewer)).findFirst()
                .map(other -> directRestriction(viewer, other, preferences.whoCanMessage(other)))
                .map(SendRestriction::wireName)
                .orElse(null);
    }

    private static List<UUID> userIds(Collection<MemberRow> members) {
        return members.stream().map(member -> member.user().id()).distinct().toList();
    }

    private List<ConversationDto> project(UUID viewer, List<ConversationRow> rows) {
        Map<UUID, List<MemberRow>> members = chat.members(rows.stream().map(ConversationRow::id).toList());
        ReceivingLanguages languages = chat.receivingLanguages(userIds(members.values().stream().flatMap(List::stream).toList()));
        Map<UUID, ChatProjector.Scope> scopes = new HashMap<>();
        List<MessageRow> lasts = new ArrayList<>();
        for (ConversationRow row : rows) {
            scopes.put(row.id(), new ChatProjector.Scope(row.kind(), members.getOrDefault(row.id(), List.of()), languages));
            chat.lastMessage(row.id()).ifPresent(lasts::add);
        }
        Map<UUID, MessageDto> lastByConversation = new HashMap<>();
        projector.many(viewer, lasts, scopes).forEach(dto -> lastByConversation.put(dto.conversationId(), dto));
        List<ConversationDto> result = new ArrayList<>();
        for (ConversationRow row : rows) {
            List<MemberRow> list = members.getOrDefault(row.id(), List.of());
            MemberRow me = list.stream().filter(m -> m.user().id().equals(viewer)).findFirst().orElse(null);
            MessageDto last = lastByConversation.get(row.id());
            result.add(new ConversationDto(
                    row.id(),
                    row.kind(),
                    row.title(),
                    row.avatarUrl(),
                    row.createdBy(),
                    list.stream().map(m -> {
                        boolean visible = graph.presenceVisible(viewer, m.user().id());
                        return new ConversationMemberDto(m.user(), m.role(), m.receivingLanguage(),
                            m.lastReadMessageId(), visible && presence.isOnline(m.user().id()), visible ? m.lastSeenAt() : null);
                    }).toList(),
                    last,
                    me == null ? 0 : chat.unreadCount(row.id(), viewer, me.lastReadAt()),
                    me == null ? null : me.mutedUntil(),
                    last != null && last.createdAt().isAfter(row.updatedAt()) ? last.createdAt() : row.updatedAt(),
                    sendRestriction(viewer, row.kind(), list)));
        }
        result.sort((a, b) -> b.updatedAt().compareTo(a.updatedAt()));
        return result;
    }
}
