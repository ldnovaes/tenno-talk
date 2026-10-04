package com.tennotalk.translation;

/** A provider stopped for a reason only the administrator can fix: invalid key or no credits. */
public record ProviderNeedsAttention(String provider, String reason) {}
