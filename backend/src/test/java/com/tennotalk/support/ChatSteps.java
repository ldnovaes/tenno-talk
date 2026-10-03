package com.tennotalk.support;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static com.tennotalk.support.TestData.as;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Small API helpers so tests read like the user's actions. */
public record ChatSteps(MockMvc mvc, JsonMapper json) {

    public UUID direct(UUID me, UUID other) throws Exception {
        return UUID.fromString(read(mvc.perform(post("/api/conversations/direct").with(as(me)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("userId", other))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asString());
    }

    public JsonNode send(UUID me, UUID conversation, String text) throws Exception {
        return send(me, conversation, text, UUID.randomUUID().toString());
    }

    public JsonNode send(UUID me, UUID conversation, String text, String clientId) throws Exception {
        return read(mvc.perform(post("/api/conversations/" + conversation + "/messages").with(as(me)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("clientId", clientId, "text", text, "mediaIds", List.of()))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    public JsonNode messages(UUID me, UUID conversation) throws Exception {
        return read(mvc.perform(get("/api/conversations/" + conversation + "/messages").with(as(me)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    public JsonNode lastMessage(UUID me, UUID conversation) throws Exception {
        JsonNode items = messages(me, conversation).get("items");
        return items.get(items.size() - 1);
    }

    public JsonNode conversations(UUID me) throws Exception {
        return read(mvc.perform(get("/api/conversations").with(as(me))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    public JsonNode read(String body) {
        return json.readTree(body);
    }
}
