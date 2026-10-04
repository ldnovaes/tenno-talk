package com.tennotalk.moderation;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.tennotalk.auth.AppPrincipal;
import com.tennotalk.common.Ids;
import com.tennotalk.moderation.ReportService.ReportDto;

@RestController
@RequestMapping("/api")
public class ReportController {

    public record NewReport(@NotBlank String targetKind, @NotNull UUID targetId, @NotBlank String reason) {}

    public record Resolution(@NotBlank String status) {}

    private final ReportService reports;

    public ReportController(ReportService reports) {
        this.reports = reports;
    }

    @PostMapping("/reports")
    public ReportDto report(@AuthenticationPrincipal AppPrincipal me, @Valid @RequestBody NewReport body) {
        return reports.report(me.userId(), body.targetKind(), body.targetId(), body.reason());
    }

    @GetMapping("/admin/reports")
    public List<ReportDto> list(@RequestParam(defaultValue = "open") String status) {
        return reports.list(status);
    }

    @PatchMapping("/admin/reports/{id}")
    public ReportDto resolve(@PathVariable String id, @Valid @RequestBody Resolution body) {
        return reports.resolve(Ids.parse(id), body.status());
    }
}
