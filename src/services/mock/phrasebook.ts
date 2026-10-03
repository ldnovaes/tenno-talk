import type { LanguageCode } from "@/types/language";

/**
 * Phrasebook used by the mock translator (PLAN.md §16.3). Each phrase lists the
 * same message in several languages; `literal` feeds Learning Mode.
 * Real translations come from the backend pipeline (ChatGPT → Claude) in Phase 8.
 */
export interface Phrase {
  id: string;
  text: Partial<Record<LanguageCode, string>>;
  literal?: Partial<Record<LanguageCode, string>>;
}

export const PHRASES: Phrase[] = [
  // Lucas ↔ Cam (pt-BR ↔ vi-VN), seeded conversation.
  {
    id: "lc_hi",
    text: {
      "vi-VN": "Chào anh! Hôm nay anh thế nào?",
      "pt-BR": "Oi! Como você está hoje?",
      "en-US": "Hi! How are you today?",
    },
    literal: { "pt-BR": "Olá irmão-mais-velho! Hoje irmão-mais-velho como?" },
  },
  {
    id: "lc_fine",
    text: {
      "pt-BR": "Oi, Cam! Estou bem, e você?",
      "vi-VN": "Chào Cam! Anh khỏe, còn em?",
      "en-US": "Hi, Cam! I'm good, and you?",
    },
  },
  {
    id: "lc_coffee",
    text: {
      "vi-VN": "Em cũng khỏe. Em vừa đi uống cà phê với bạn.",
      "pt-BR": "Eu também estou bem. Acabei de tomar café com uma amiga.",
      "en-US": "I'm good too. I just had coffee with a friend.",
    },
  },
  {
    id: "lc_best_coffee",
    text: {
      "pt-BR": "Que delícia! Café vietnamita é o melhor.",
      "vi-VN": "Tuyệt quá! Cà phê Việt Nam là ngon nhất.",
      "en-US": "Lovely! Vietnamese coffee is the best.",
    },
  },
  {
    id: "lc_take_you",
    text: {
      "vi-VN": "Đúng rồi! Lần sau anh đến, em sẽ dẫn anh đi.",
      "pt-BR": "Isso mesmo! Da próxima vez que você vier, eu te levo.",
      "en-US": "Exactly! Next time you come, I'll take you.",
    },
  },
  {
    id: "lc_deal",
    text: { "pt-BR": "Combinado! 😄", "vi-VN": "Hứa nhé! 😄", "en-US": "Deal! 😄" },
  },
  {
    id: "lc_morning",
    text: {
      "pt-BR": "Bom dia! Dormiu bem?",
      "vi-VN": "Chào buổi sáng! Em ngủ ngon không?",
      "en-US": "Good morning! Did you sleep well?",
    },
  },
  {
    id: "lc_slept",
    text: {
      "vi-VN": "Em ngủ rất ngon ạ ♡",
      "pt-BR": "Dormi muito bem ♡",
      "en-US": "I slept really well ♡",
    },
    literal: { "pt-BR": "Eu dormi muito gostoso (polido) ♡" },
  },
  {
    id: "lc_tiring",
    text: {
      "pt-BR": "Hoje foi um dia cansativo, mas falar com você já me deixa melhor.",
      "vi-VN": "Hôm nay là một ngày mệt mỏi, nhưng nói chuyện với em làm anh thấy tốt hơn rồi.",
      "en-US": "Today was a tiring day, but talking to you already makes me feel better.",
    },
  },
  {
    id: "lc_rest",
    text: {
      "vi-VN": "Anh nghỉ ngơi đi nhé. Đừng làm việc quá sức.",
      "pt-BR": "Descanse, tá? Não trabalhe demais.",
      "en-US": "Get some rest, okay? Don't overwork yourself.",
    },
  },
  {
    id: "lc_night",
    text: {
      "pt-BR": "Pode deixar. Boa noite!",
      "vi-VN": "Anh biết rồi. Chúc em ngủ ngon!",
      "en-US": "Will do. Good night!",
    },
  },
  {
    id: "lc_night_reply",
    text: { "vi-VN": "Chúc anh ngủ ngon 🌙", "pt-BR": "Boa noite 🌙", "en-US": "Good night 🌙" },
  },
  {
    id: "lc_miss",
    text: {
      "pt-BR": "Estou com saudade de você.",
      "vi-VN": "Anh nhớ em.",
      "en-US": "I miss you.",
    },
    literal: { "vi-VN": "Estou com saudade (lembrança) de você." },
  },
  {
    id: "lc_miss_too",
    text: {
      "vi-VN": "Em cũng nhớ anh.",
      "pt-BR": "Eu também estava com saudade de você.",
      "en-US": "I miss you too.",
    },
    literal: { "pt-BR": "Eu também lembro de você.", "en-US": "I also remember you." },
  },
  {
    id: "lc_weekend",
    text: {
      "vi-VN": "Cuối tuần này anh có rảnh không?",
      "pt-BR": "Você está livre neste fim de semana?",
      "en-US": "Are you free this weekend?",
    },
    literal: { "pt-BR": "Fim de semana este você tem livre não?" },
  },
  {
    id: "lc_video",
    text: {
      "pt-BR": "Estou sim! Vamos fazer uma chamada de vídeo?",
      "vi-VN": "Anh rảnh! Mình gọi video nhé?",
      "en-US": "I am! Shall we do a video call?",
    },
  },
  {
    id: "lc_saturday",
    text: {
      "vi-VN": "Được ạ! Thứ Bảy lúc 8 giờ tối nhé.",
      "pt-BR": "Pode ser! Sábado às 8 da noite, então.",
      "en-US": "Sure! Saturday at 8 pm, then.",
    },
  },
  {
    id: "lc_cant_wait",
    text: {
      "pt-BR": "Perfeito. Mal posso esperar!",
      "vi-VN": "Tuyệt vời. Anh mong lắm!",
      "en-US": "Perfect. I can't wait!",
    },
  },
  // Older small talk (history for pagination).
  {
    id: "lc_old_1",
    text: {
      "pt-BR": "Que foto linda!",
      "vi-VN": "Ảnh đẹp quá!",
      "en-US": "What a beautiful photo!",
    },
  },
  {
    id: "lc_old_2",
    text: {
      "vi-VN": "Cảm ơn anh! Em chụp ở Hồ Gươm.",
      "pt-BR": "Obrigada! Tirei no Lago Hoan Kiem.",
      "en-US": "Thank you! I took it at Hoan Kiem Lake.",
    },
  },
  {
    id: "lc_old_3",
    text: {
      "pt-BR": "Um dia quero conhecer Hà Nội.",
      "vi-VN": "Một ngày nào đó anh muốn đến Hà Nội.",
      "en-US": "One day I want to visit Hà Nội.",
    },
  },
  {
    id: "lc_old_4",
    text: {
      "vi-VN": "Anh sẽ thích lắm cho xem!",
      "pt-BR": "Você vai adorar, pode ter certeza!",
      "en-US": "You'll love it, I promise!",
    },
  },
  {
    id: "lc_old_5",
    text: {
      "pt-BR": "Você já provou feijoada?",
      "vi-VN": "Em đã từng ăn feijoada chưa?",
      "en-US": "Have you ever tried feijoada?",
    },
  },
  {
    id: "lc_old_6",
    text: {
      "vi-VN": "Chưa ạ. Nó giống món gì?",
      "pt-BR": "Ainda não. Parece com o quê?",
      "en-US": "Not yet. What is it like?",
    },
  },
  {
    id: "lc_old_7",
    text: {
      "pt-BR": "É um ensopado de feijão preto com carne. Muito bom!",
      "vi-VN": "Đó là món hầm đậu đen với thịt. Ngon lắm!",
      "en-US": "It's a black bean stew with meat. Really good!",
    },
  },
  {
    id: "lc_old_8",
    text: {
      "vi-VN": "Nghe ngon quá! Anh nấu cho em ăn nhé.",
      "pt-BR": "Parece delicioso! Cozinha pra mim um dia?",
      "en-US": "Sounds delicious! Cook it for me one day?",
    },
  },
  // Lucas ↔ Sofía (pt-BR ↔ es-ES)
  {
    id: "ls_1",
    text: {
      "es-ES": "¡Hola Lucas! ¿Qué tal tu semana?",
      "pt-BR": "Oi Lucas! Como foi sua semana?",
      "en-US": "Hi Lucas! How was your week?",
    },
  },
  {
    id: "ls_2",
    text: {
      "pt-BR": "Corrida, mas boa! E a sua?",
      "es-ES": "¡Ajetreada, pero buena! ¿Y la tuya?",
      "en-US": "Busy, but good! And yours?",
    },
  },
  {
    id: "ls_3",
    text: {
      "es-ES": "Muy bien. Estoy preparando un concierto.",
      "pt-BR": "Muito bem. Estou preparando um show.",
      "en-US": "Very good. I'm preparing a concert.",
    },
  },
  {
    id: "ls_4",
    text: {
      "pt-BR": "Que legal! Me manda o vídeo depois.",
      "es-ES": "¡Qué genial! Mándame el video después.",
      "en-US": "So cool! Send me the video later.",
    },
  },
  {
    id: "ls_5",
    text: { "es-ES": "¡Claro que sí! 🎶", "pt-BR": "Claro que sim! 🎶", "en-US": "Of course! 🎶" },
  },
  // Lucas ↔ Emma (pt-BR ↔ en-US)
  {
    id: "le_1",
    text: {
      "en-US": "Hey! Do you have any Brazilian music recommendations?",
      "pt-BR": "Oi! Você tem alguma recomendação de música brasileira?",
    },
  },
  {
    id: "le_2",
    text: {
      "pt-BR": "Claro! Escuta Tim Maia e Marisa Monte.",
      "en-US": "Of course! Listen to Tim Maia and Marisa Monte.",
    },
  },
  {
    id: "le_3",
    text: {
      "en-US": "Thanks! I'll check them out tonight.",
      "pt-BR": "Valeu! Vou ouvir hoje à noite.",
    },
  },
  // Minh → Lucas (vi-VN → pt-BR)
  {
    id: "lm_1",
    text: {
      "vi-VN": "Chào anh Lucas, em là bạn của Cam.",
      "pt-BR": "Oi Lucas, sou amigo da Cam.",
      "en-US": "Hi Lucas, I'm Cam's friend.",
    },
  },
  {
    id: "lm_2",
    text: {
      "vi-VN": "Anh có muốn đi ăn phở cùng tụi em không?",
      "pt-BR": "Você quer comer phở com a gente?",
      "en-US": "Do you want to have phở with us?",
    },
  },
  // Yuki ↔ Lucas (ja-JP ↔ pt-BR)
  {
    id: "ly_1",
    text: {
      "ja-JP": "こんにちは！ブラジルのコーヒーが好きです。",
      "pt-BR": "Olá! Eu gosto de café brasileiro.",
      "en-US": "Hello! I like Brazilian coffee.",
    },
  },
  {
    id: "ly_2",
    text: {
      "pt-BR": "Que bom! Qual é o seu favorito?",
      "ja-JP": "いいですね！どれが一番好きですか？",
      "en-US": "Nice! Which one is your favorite?",
    },
  },
  // Omar ↔ Lucas (ar ↔ pt-BR, RTL)
  {
    id: "lo_1",
    text: {
      ar: "مرحبا لوكاس! كيف حالك؟",
      "pt-BR": "Olá Lucas! Como você está?",
      "en-US": "Hello Lucas! How are you?",
    },
  },
  {
    id: "lo_2",
    text: {
      "pt-BR": "Tudo ótimo, Omar! E você?",
      ar: "كل شيء رائع يا عمر! وأنت؟",
      "en-US": "All great, Omar! And you?",
    },
  },
  // Ji-soo ↔ Cam (ko-KR ↔ vi-VN)
  {
    id: "cj_1",
    text: {
      "ko-KR": "안녕하세요 Cam! 베트남어를 배우고 있어요.",
      "vi-VN": "Xin chào Cam! Mình đang học tiếng Việt.",
      "en-US": "Hi Cam! I'm learning Vietnamese.",
    },
  },
  {
    id: "cj_2",
    text: {
      "vi-VN": "Giỏi quá! Mình giúp bạn nhé.",
      "ko-KR": "대단해요! 제가 도와줄게요.",
      "en-US": "Awesome! I'll help you.",
    },
  },
  // Auto-responder replies.
  {
    id: "ar_vi_1",
    text: {
      "vi-VN": "Thật à? Kể em nghe thêm đi!",
      "pt-BR": "Sério? Me conta mais!",
      "en-US": "Really? Tell me more!",
    },
  },
  {
    id: "ar_vi_2",
    text: {
      "vi-VN": "Haha, anh dễ thương quá 😄",
      "pt-BR": "Haha, você é muito fofo 😄",
      "en-US": "Haha, you're so sweet 😄",
    },
  },
  {
    id: "ar_vi_3",
    text: { "vi-VN": "Em đồng ý!", "pt-BR": "Concordo!", "en-US": "I agree!" },
  },
  {
    id: "ar_vi_4",
    text: {
      "vi-VN": "Để em nghĩ đã nhé.",
      "pt-BR": "Deixa eu pensar um pouco.",
      "en-US": "Let me think about it.",
    },
  },
  {
    id: "ar_es_1",
    text: {
      "es-ES": "¡Qué bien! Cuéntame más.",
      "pt-BR": "Que bom! Me conta mais.",
      "en-US": "Great! Tell me more.",
    },
  },
  {
    id: "ar_es_2",
    text: { "es-ES": "Jaja, me encanta.", "pt-BR": "Haha, adorei.", "en-US": "Haha, I love it." },
  },
  {
    id: "ar_en_1",
    text: { "en-US": "That sounds great!", "pt-BR": "Parece ótimo!", "vi-VN": "Nghe hay quá!" },
  },
  {
    id: "ar_en_2",
    text: { "en-US": "Haha, totally.", "pt-BR": "Haha, com certeza.", "vi-VN": "Haha, đúng vậy." },
  },
  {
    id: "ar_pt_1",
    text: {
      "pt-BR": "Que legal!",
      "vi-VN": "Hay quá!",
      "en-US": "How cool!",
      "es-ES": "¡Qué guay!",
    },
  },
  {
    id: "ar_pt_2",
    text: {
      "pt-BR": "Hahaha, adorei!",
      "vi-VN": "Hahaha, thích quá!",
      "en-US": "Hahaha, loved it!",
      "es-ES": "¡Jajaja, me encantó!",
    },
  },
  {
    id: "ar_ja_1",
    text: { "ja-JP": "すごいですね！", "pt-BR": "Que incrível!", "en-US": "That's amazing!" },
  },
  {
    id: "ar_ar_1",
    text: { ar: "رائع جدًا!", "pt-BR": "Muito legal!", "en-US": "Really great!" },
  },
  {
    id: "ar_ko_1",
    text: { "ko-KR": "정말 좋아요!", "vi-VN": "Thật tuyệt!", "en-US": "Really nice!" },
  },
  // Common short messages people type in demos.
  {
    id: "common_hi",
    text: {
      "pt-BR": "Oi",
      "vi-VN": "Chào",
      "en-US": "Hi",
      "es-ES": "Hola",
      "ja-JP": "こんにちは",
      ar: "مرحبا",
      "ko-KR": "안녕하세요",
    },
  },
  {
    id: "common_how",
    text: {
      "pt-BR": "Tudo bem?",
      "vi-VN": "Bạn khỏe không?",
      "en-US": "How are you?",
      "es-ES": "¿Qué tal?",
    },
  },
  {
    id: "common_thanks",
    text: {
      "pt-BR": "Obrigado!",
      "vi-VN": "Cảm ơn!",
      "en-US": "Thank you!",
      "es-ES": "¡Gracias!",
      "ja-JP": "ありがとう！",
    },
  },
  {
    id: "common_love",
    text: {
      "pt-BR": "Eu te amo",
      "vi-VN": "Anh yêu em",
      "en-US": "I love you",
      "es-ES": "Te quiero",
    },
    literal: { "vi-VN": "Eu amo você (homem para mulher)" },
  },
  {
    id: "common_love_too",
    text: {
      "vi-VN": "Em cũng yêu anh",
      "pt-BR": "Eu também te amo",
      "en-US": "I love you too",
      "es-ES": "Yo también te quiero",
    },
  },
  {
    id: "common_morning",
    text: {
      "pt-BR": "Bom dia",
      "vi-VN": "Chào buổi sáng",
      "en-US": "Good morning",
      "es-ES": "Buenos días",
    },
  },
  {
    id: "common_night",
    text: {
      "pt-BR": "Boa noite",
      "vi-VN": "Chúc ngủ ngon",
      "en-US": "Good night",
      "es-ES": "Buenas noches",
    },
  },
];

export function phraseById(id: string): Phrase {
  const phrase = PHRASES.find((p) => p.id === id);
  if (!phrase) throw new Error(`Unknown phrase ${id}`);
  return phrase;
}
