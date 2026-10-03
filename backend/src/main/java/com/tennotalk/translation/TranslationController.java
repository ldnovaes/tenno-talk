package com.tennotalk.translation;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.tennotalk.auth.AppPrincipal;
import com.tennotalk.chat.ChatDtos.ContentTranslationDto;
import com.tennotalk.common.Ids;

@RestController
@RequestMapping("/api")
public class TranslationController {

    private final TranslationService translations;

    public TranslationController(TranslationService translations) {
        this.translations = translations;
    }

    @PostMapping("/messages/{id}/translation/retry")
    public ContentTranslationDto retry(@AuthenticationPrincipal AppPrincipal me, @PathVariable String id) {
        return translations.retry(me.userId(), Ids.parse(id));
    }

    @GetMapping("/messages/{id}/insight")
    public TranslationService.InsightDto insight(@AuthenticationPrincipal AppPrincipal me, @PathVariable String id,
            @RequestParam String lang) {
        return translations.insight(me.userId(), Ids.parse(id), lang);
    }

    @PostMapping("/translations/{kind}/{id}")
    public ContentTranslationDto translateContent(@AuthenticationPrincipal AppPrincipal me, @PathVariable String kind,
            @PathVariable String id, @RequestParam String lang) {
        return translations.translateContent(me.userId(), kind, Ids.parse(id), lang);
    }
}
