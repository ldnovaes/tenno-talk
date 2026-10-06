package com.tennotalk.db;

import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import com.tennotalk.moderation.ReportService;
import com.tennotalk.notifications.NotificationService;
import com.tennotalk.recommender.learning.InteractionKind;
import com.tennotalk.support.Actions;
import com.tennotalk.support.IntegrationTest;
import com.tennotalk.translation.ProviderState;
import com.tennotalk.users.ProfileService;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The values the Java code writes and the CHECK constraints of the database are the same sets (PLAN.md §27): a
 * value the code knows but the database refuses is a 500 the first time it happens in production.
 */
class EnumConstraintsIT extends IntegrationTest {

    private static Set<String> privateSet(Class<?> owner, String field) {
        try {
            var declared = owner.getDeclaredField(field);
            declared.setAccessible(true);
            Object value = declared.get(null);
            Collection<?> values = value instanceof Map<?, ?> map ? map.keySet() : (Collection<?>) value;
            return values.stream().map(String::valueOf).collect(Collectors.toCollection(TreeSet::new));
        } catch (ReflectiveOperationException e) {
            throw new AssertionError(e);
        }
    }

    private static Set<String> of(Collection<String> values) {
        return new TreeSet<>(values);
    }

    static Stream<Arguments> pairs() {
        Set<String> audiences = privateSet(ProfileService.class, "AUDIENCES");
        return Stream.of(
                Arguments.of("notifications", "type", privateSet(NotificationService.class, "PREFERENCE")),
                Arguments.of("notifications", "type", of(Actions.NOTIFICATION_TYPES)),
                Arguments.of("reports", "target_kind", of(ReportService.KINDS)),
                Arguments.of("reports", "status", of(ReportService.STATUSES)),
                Arguments.of("interaction_events", "kind", of(Arrays.stream(InteractionKind.values()).map(InteractionKind::code).toList())),
                Arguments.of("ai_provider_status", "state", of(List.of(ProviderState.OK, ProviderState.INVALID_KEY, ProviderState.COOLING_DOWN))),
                Arguments.of("user_preferences", "profile_visibility", privateSet(ProfileService.class, "VISIBILITY")),
                Arguments.of("user_preferences", "who_can_message", audiences),
                Arguments.of("user_preferences", "who_can_comment", audiences),
                Arguments.of("user_preferences", "who_can_see_online", audiences),
                Arguments.of("media", "kind", of(List.of("image", "video", "audio", "file"))),
                Arguments.of("content_translations", "content_kind", of(List.of("post", "comment", "story"))));
    }

    /** Values of {@code column IN (...)} in the table's CHECK constraints. */
    private Set<String> allowed(String table, String column) {
        List<String> definitions = jdbc.sql("""
                SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
                WHERE c.conrelid = CAST(:t AS regclass) AND c.contype = 'c'
                """).param("t", table).query(String.class).list();
        Pattern quoted = Pattern.compile("'([^']*)'::text");
        for (String definition : definitions) {
            if (!definition.contains("(" + column + " ") && !definition.contains("(" + column + ")")) continue;
            Set<String> values = new TreeSet<>();
            Matcher matcher = quoted.matcher(definition);
            while (matcher.find()) values.add(matcher.group(1));
            return values;
        }
        throw new AssertionError("No CHECK on " + table + "." + column + " in " + definitions);
    }

    @ParameterizedTest(name = "{0}.{1}")
    @MethodSource("pairs")
    void theCodeAndTheDatabaseAgree(String table, String column, Set<String> code) {
        assertThat(allowed(table, column)).isEqualTo(code);
    }
}
