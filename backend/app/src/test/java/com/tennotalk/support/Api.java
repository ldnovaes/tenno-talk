package com.tennotalk.support;

import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static com.tennotalk.support.TestData.as;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Terse authenticated calls: {@code api.post(user, "/api/posts", body)}. */
public record Api(MockMvc mvc, JsonMapper json) {

    public ResultActions get(UUID user, String path) throws Exception {
        return mvc.perform(MockMvcRequestBuilders.get(path).with(as(user)));
    }

    /** JSON body (or none when {@code body} is null) + CSRF, like the SPA. */
    public ResultActions post(UUID user, String path, Object body) throws Exception {
        var request = MockMvcRequestBuilders.post(path).with(as(user)).with(csrf());
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        return mvc.perform(request);
    }

    public ResultActions patch(UUID user, String path, Object body) throws Exception {
        return mvc.perform(MockMvcRequestBuilders.patch(path).with(as(user)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }

    public ResultActions put(UUID user, String path) throws Exception {
        return mvc.perform(MockMvcRequestBuilders.put(path).with(as(user)).with(csrf()));
    }

    public ResultActions delete(UUID user, String path) throws Exception {
        return mvc.perform(MockMvcRequestBuilders.delete(path).with(as(user)).with(csrf()));
    }

    public JsonNode ok(ResultActions actions) throws Exception {
        return json.readTree(actions.andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    public JsonNode getOk(UUID user, String path) throws Exception {
        return ok(get(user, path));
    }

    public JsonNode postOk(UUID user, String path, Object body) throws Exception {
        return ok(post(user, path, body));
    }
}
