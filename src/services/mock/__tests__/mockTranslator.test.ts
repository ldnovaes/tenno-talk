import { describe, expect, it } from "vitest";

import { translateText } from "@/services/mock/mockTranslator";

describe("mockTranslator", () => {
  it("uses the phrasebook (case and punctuation insensitive)", () => {
    expect(translateText("estou com saudade de você", "pt-BR", "vi-VN").natural).toBe(
      "Anh nhớ em.",
    );
    expect(translateText("Em cũng nhớ anh.", "vi-VN", "pt-BR")).toEqual({
      natural: "Eu também estava com saudade de você.",
      literal: "Eu também lembro de você.",
    });
  });

  it("falls back to a sibling variant of the target language", () => {
    expect(translateText("Anh nhớ em.", "vi-VN", "pt-PT").natural).toBe(
      "Estou com saudade de você.",
    );
  });

  it("marks unknown sentences as pseudo translations", () => {
    expect(translateText("Frase desconhecida", "pt-BR", "vi-VN")).toEqual({
      natural: "«vi» Frase desconhecida",
      literal: "«vi» Frase desconhecida",
    });
  });
});
