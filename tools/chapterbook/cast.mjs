// 만화 그림(이미지 생성 AI)용 인물 외모표 — 같은 인물이 컷·장마다 같은 얼굴·옷으로 나오게 한다.
// 이름은 원고 comic.art[].name 그대로. 나이가 장마다 달라지는 인물은 age(ch)로 고른다.
// 규칙 원본: docs/policy/장별해설서_제작지침.md §2-0
const by = (table) => (ch) => table.find(([max]) => ch <= max)[1];

const CAST = {
  아담: "Adam: young man, wavy chestnut-brown hair, short brown beard, kind eyes, simple blue linen robe with rope belt",
  여자: "Eve: young woman, long wavy dark-brown hair, gentle face, simple plum-colored linen robe",
  이브: "Eve: young woman, long wavy dark-brown hair, gentle face, simple plum-colored linen robe",
  카인: "Cain: young farmer, short black hair, stubble, stern brows, rough reddish-brown tunic",
  아벨: "Abel: younger shepherd, curly light-brown hair, beardless, cream-colored tunic, shepherd's staff",
  에녹: "Enoch: serene middle-aged man, dark beard, white robe",
  노아: "Noah: very old but strong man, long white beard and white hair, kind wise face, olive-green robe with brown sash",
  솀: "Shem: adult son of Noah, dark hair, short dark beard, teal robe",
  함: "Ham: adult son of Noah, curly black hair, short beard, ochre-yellow robe",
  야펫: "Japheth: adult son of Noah, light-brown hair, short beard, light-blue robe",
  아브람: "Abram: man in his late 70s, grey-streaked dark beard, white head-wrap, deep-red robe with brown striped mantle",
  "75세 아브람": "Abram: man in his late 70s, grey-streaked dark beard, white head-wrap, deep-red robe with brown striped mantle",
  "86세 아브람": "Abram: man in his late 80s, mostly grey beard, white head-wrap, deep-red robe with brown striped mantle",
  아브라함: "Abraham: elderly man about 100, long white beard, white head-wrap, deep-red robe with brown striped mantle, wooden staff",
  사래: "Sarai: beautiful woman about 65, dark hair under a cream veil, rose-red dress",
  사라: "Sarah: graceful elderly beautiful woman, silver hair under a cream veil, rose-red dress",
  롯: "Lot: middle-aged man, short black beard, mustard-yellow robe",
  하갈: "Hagar: young Egyptian woman, bronze skin, straight black hair, white linen dress with turquoise beads",
  엘리에젤: "Eliezer: Abraham's old steward, grey beard, plain brown robe",
  종: "Abraham's old servant: grey beard, plain brown robe, brown head-wrap",
  아비멜렉: "Abimelech: king of Gerar, black beard, small gold crown, purple royal robe",
  에프론: "Ephron the Hittite: middle-aged man, curly beard, yellow robe with geometric border",
  라반: "Laban: middle-aged man, grey-black beard, rich orange-brown striped robe",
  리브카: null, 이삭: null, 이스마엘: null, 에서: null, 야곱: null, 요셉: null,
  라헬: "Rachel: beautiful young shepherdess, long dark hair, light-blue dress, white headscarf",
  레아: "Leah: young woman, light-brown hair, gentle tired eyes, lavender dress",
  빌하: "Bilhah: young maidservant, black hair tied back, beige dress",
  질파: "Zilpah: young maidservant, brown hair in a braid, pale-green dress",
  파라오: "Pharaoh: Egyptian king, clean-shaven, striped nemes headdress, white linen and gold collar",
  멜키제덱: "Melchizedek: shown only as a dignified figure in soft radiant light",
  유다: "Judah: strong adult man, thick dark beard, earnest face, rust-orange robe",
  르우벤: "Reuben: eldest brother, tall man, brown beard, worried kind eyes, dark-green robe",
  시므온: "Simeon: fierce man, black beard, scarred brow, dark-brown robe",
  레위: "Levi: fierce man, black beard, sharp eyes, grey robe",
  베냐민: "Benjamin: youngest brother, gentle young man, curly dark hair, light beard, pale-yellow robe",
  디나: "Dinah: young woman, long black hair, rose-pink dress, light veil",
  셰켐: "Shechem: young Hivite prince, black curly hair, short beard, embroidered red-and-gold robe",
  하몰: "Hamor: older Hivite chief, grey beard, embroidered red-and-gold robe with a fur mantle",
  포티팔: "Potiphar: Egyptian captain of the guard, clean-shaven, black bob wig, white linen kilt, gold collar",
  "포티팔의 아내": "Potiphar's wife: Egyptian noblewoman, black braided wig, modest white linen dress, gold jewelry",
  청지기: "Joseph's steward: Egyptian household manager, clean-shaven, shaved head, white linen kilt and short cape",
  타말:"Tamar: young woman, long dark hair, deep-blue dress and veil",
  아스낫: "Asenath: young Egyptian noblewoman, black braided wig, white linen dress",
  므낫세: "Manasseh: boy (Joseph's elder son), Egyptian-style white tunic, dark hair",
  에브라임: "Ephraim: younger boy (Joseph's younger son), Egyptian-style white tunic, dark hair",
  "술 맡은 자": "the chief butler: Egyptian court servant, clean-shaven, white linen, holding a gold cup",
  "빵 굽는 자": "the chief baker: Egyptian court servant, clean-shaven, white linen, three baskets on his head",
};
const AGED = {
  이삭: by([[21, "Isaac: little boy (toddler), curly brown hair, sky-blue tunic"], [22, "Isaac: young man in his teens, beardless, curly brown hair, sky-blue tunic"], [25, "Isaac: man about 40-60, curly brown hair, short beard, sky-blue robe"], [26, "Isaac: mature man, brown beard with grey, sky-blue robe"], [99, "Isaac: very old blind man, white beard, cloudy eyes, sky-blue robe"]]),
  리브카: by([[24, "Rebekah: beautiful young woman, long black braided hair, green dress, clay water jar"], [99, "Rebekah: beautiful mature woman, black hair with a little grey under a green veil, green dress"]]),
  이스마엘: by([[16, "Ishmael: baby"], [21, "Ishmael: teenage boy, bronze skin, black hair, tan tunic"], [99, "Ishmael: grown man, bronze skin, black beard, tan tunic, bow and quiver"]]),
  에서: by([[25, "Esau: young man, ruddy skin, wild red hair, very hairy arms, rough brown leather tunic, hunter"], [99, "Esau: adult man, ruddy skin, wild red hair and red beard, hairy arms, brown leather tunic, bow and quiver"]]),
  야곱: by([[27, "Jacob: young man, smooth skin, neat dark hair, short trim beard, blue-grey robe"], [36, "Jacob: adult man, dark hair, trim dark beard, blue-grey robe, shepherd's staff"], [99, "Jacob (Israel): very old man, long white beard, blue-grey robe, leaning on a staff"]]),
  요셉: by([[37, "Joseph: handsome 17-year-old shepherd, wavy black hair, beardless, long richly colored striped coat"], [40, "Joseph: handsome young man, beardless, black hair, plain white linen servant's tunic"], [49, "Joseph: handsome man about 30-40, clean-shaven Egyptian style, black hair, white linen robe, gold collar and signet ring (governor of Egypt)"], [99, "Joseph: dignified man about 55, clean-shaven Egyptian style, black hair touched with grey, white linen robe, gold collar and signet ring (governor of Egypt)"]]),
};

// 앞부분 장에서 이름 대신 쓴 말: 창 1–4장의 사람·남자는 아담, 여자·아내는 이브
const ALIAS = { 사람: [4, "아담"], 남자: [4, "아담"], 남성: [4, "아담"], 아내: [4, "이브"], 여성: [4, "이브"] };

// 관계도 초상(portraitart.mjs)용: 원고 이름의 괄호 풀이를 떼고(아브라함(아브람) → 아브라함) 같은 사람으로 찾는다
const PALIAS = { 이스라엘: "야곱", "사람(남성과 여성)": "사람(남성과 여성)" };
CAST["사람(남성과 여성)"] = "Adam and Eve together: young man with wavy chestnut-brown hair, short brown beard, simple blue linen robe; young woman with long wavy dark-brown hair, simple plum-colored linen robe";
CAST["뱀"] = "the serpent in the garden of Eden: a beautiful, cunning serpent with shimmering scales coiled on a fruit-tree branch (not a horror monster)";
export function portraitDesc(p, ch) {
  if (p.role === "god") return null;
  if (CAST[p.name]) return CAST[p.name];
  let n = p.name.replace(/\(.*?\)/g, "").trim();
  n = PALIAS[n] || n;
  return castOf(n, ch, null);
}

export function castOf(name, ch, fallback) {
  if (ALIAS[name] && ch <= ALIAS[name][0]) name = ALIAS[name][1];
  const key = name.replace(/\s*\d+세$/, "");
  if (AGED[key]) return AGED[key](ch);
  if (CAST[name]) return CAST[name];
  if (CAST[key]) return CAST[key];
  return fallback;
}
