# Soliq va Ombor Hisobi — 1-versiya

Buxgalterlar uchun veb-tizim: QQS (oylik), foyda solig'i (choraklik, yil boshidan o'sib boruvchi), aylanma solig'i, MXIK bo'yicha ombor hisobi, asosiy vositalar eskirishi, xarajatlar, kontragentlar va qarzlar. Interfeys uch tilda: o'zbek (lotin), o'zbek (kirill), rus.

## Papkalar

| Fayl / papka | Vazifasi |
|---|---|
| `index.html` | Ilovaning o'zi |
| `js/` | Dastur kodi (`config.js` — sozlama) |
| `mxik/` | MXIK katalogi: 391 117 ta kod, 87 ta guruh fayli (gzip), o'lchov birliklari |
| `supabase/schema.sql` | Bulut bazasi uchun SQL (jadvallar, himoya qoidalari) |

## Ikki rejim

**Lokal rejim** (`js/config.js` da Supabase bo'sh). Ma'lumotlar shu kompyuterdagi brauzerda saqlanadi. Birinchi kirish: login `admin`, parol `admin`, keyin parolni almashtirish so'raladi. Sozlamalar bo'limidan muntazam zaxira nusxa (JSON) oling.

**Bulut rejimi** (Supabase). Istalgan qurilmadan kirish, ma'lumot serverda, buxgalterlar o'z loginlari bilan ishlaydi.

## Saytga joylash (Vercel, bepul)

1. Shu papkani GitHub omboriga yuklang.
2. vercel.com → Add New Project → omborni tanlang → Deploy. Hech qanday build sozlamasi kerak emas.

Kompyuterda sinash uchun: papka ichida `npx serve .` yoki `python -m http.server`, keyin brauzerda `http://localhost:3000` (yoki `:8000`). `index.html` ni ikki marta bosib ochsangiz MXIK katalogi yuklanmaydi, chunki brauzer mahalliy fayllarni o'qishga ruxsat bermaydi.

## Bulut rejimini yoqish (Supabase) — real ishlatish uchun

**1. Supabase loyihasi**
1. supabase.com → Sign up (GitHub orqali kirish qulay) → **New project**.
2. Nomi: `soliq-ombor`, parolni yozib qo'ying, Region: **Central EU (Frankfurt)** (O'zbekistonga eng yaqini).
3. Loyiha ochilgach: **SQL Editor → New query** → `supabase/schema.sql` faylini to'liq joylab **Run**. "Success" chiqishi kerak.

**2. Kirish sozlamalari**
1. **Authentication → Sign In / Providers → Email**: "Confirm email" ni **o'chiring** (buxgalterlar login bilan kiradi, email tasdiqlanmaydi). "Allow new users to sign up" **yoqiq qolsin** — admin buxgalterlarni shu orqali yaratadi. Begona odam ro'yxatdan o'tsa ham, admin faollashtirmaguncha hech narsaga kira olmaydi.
2. **Authentication → Users → Add user → Create new user**: email `admin@soliq-hisob.app`, o'zingizning kuchli parolingiz, **Auto Confirm User** belgilansin.
3. SQL Editor da: `update public.profiles set role = 'admin', active = true, firm_limit = 999 where login = 'admin';`

**3. Kalitlarni saytga yozish**
1. **Project Settings → API**: `Project URL` va `anon public` kalitini nusxalang.
2. `js/config.js` faylida: `supabaseUrl: 'https://xxxx.supabase.co'`, `supabaseAnonKey: 'eyJ...'` (anon kalit ochiq kalit, saytda turishi normal; `service_role` kalitini hech qachon yozmang).

**4. Saytni internetga chiqarish (Vercel)**
1. github.com → New repository (Private) → shu papkadagi barcha fayllarni yuklang.
2. vercel.com → Add New → Project → shu omborni tanlang → Deploy. `https://....vercel.app` manzil beriladi.
3. Xohlasangiz o'z domeningizni ulang: Vercel → Settings → Domains.

**5. Birinchi kirish va buxgalter qo'shish**
1. Saytni oching → login `admin`, 2-qadamdagi parol. Yuqorida "BULUT" yozuvi chiqishi kerak (LOKAL emas).
2. Buxgalterlar → Buxgalter qo'shish: login (masalan `ali`), vaqtinchalik parol, firmalar limiti, obuna tugash sanasi.
3. Buxgalterga sayt manzili, login va parolni bering. Birinchi kirishda u parolni o'zi almashtiradi.

**Muhim:**
- Avval o'zingiz sinov buxgalteri ochib, ikki xil qurilmadan tekshiring, keyin mijozlarga bering.
- Bepul Supabase loyihasi 7 kun hech kim kirmasa "uxlab qoladi" va kunlik zaxira nusxa olmaydi. Pullik mijozlar bilan ishlaganda **Pro tarifiga** (oyiga taxminan 25 $) o'ting.
- Supabase serverlari O'zbekistondan tashqarida. Shaxsga doir ma'lumotlarni mamlakat ichida saqlash talabi bo'yicha sotishdan oldin yurist bilan maslahatlashing.
- Lokal rejimda kiritilgan ma'lumotlar bulutga avtomatik o'tmaydi.

## Hisob-kitob qoidalari

- **Tannarx:** firma sozlamasida o'rtacha yoki FIFO. Har bir ombor alohida hisoblanadi.
- **QQS:** hisoblangan (sotuv − xaridordan qaytish) − hisobga olinadigan (kirim − yetkazib beruvchiga qaytarish + xarajatlar + asosiy vositalar). Manfiy natija keyingi oyga o'tadi. Aylanma solig'i to'lovchida kirimdagi QQS tannarxga qo'shiladi.
- **Foyda solig'i:** daromad (tushum + inventarizatsiya ortiqchasi) − sotilgan tovar tannarxi − chegiriladigan xarajatlar − eskirish − chegiriladigan yo'qotishlar. Yil boshidan o'sib boruvchi; chorak to'lovi = yil boshidan soliq − oldingi choraklar.
- **Aylanma solig'i:** tushum + boshqa daromadlar, firma stavkasi bo'yicha, oylik va choraklik.
- **Eskirish:** foydalanishga topshirilgan oydan keyingi oydan, yillik foizda yoki oylik so'mda, tugatish qiymatiga yetguncha.
- **QQS stavkalari:** 12%, 6% (admin panelida o'zgartiriladi), imtiyozli (foiz mahsulotda yoki hujjat qatorida qo'lda kiritiladi, imtiyoz kodi bilan) va "QQSdan ozod".
- **Ishlab chiqarish:** "Ishlab chiqarish" bo'limida mahsulot uchun kalkulyatsiya kiritiladi: cheklanmagan homashyolar (1 birlikka miqdor, ixtiyoriy yo'qotish %) va xarajatlar (ish haqi, elektr va b., 1 birlikka so'mda). "Ishlab chiqarish" hujjati homashyoni homashyo omboridan chiqaradi va tayyor mahsulotni tayyor mahsulot omboriga kiritadi; sotuv tayyor mahsulotdan chiqariladi. Homashyo ombordagi o'lchov birligida chiqariladi. Xarajatlar standart holatda faqat tannarxni bilish uchun ko'rsatiladi; hujjatda belgi qo'yilsa ombor tannarxiga qo'shiladi (unda ularni "Xarajatlar" bo'limida qayta kiritmang).
- **O'lchov birliklari:** mahsulotning asosiy (ombor) birligi va istalgancha qo'shimcha birliklari bor (masalan, 1 qop = 0,05 tonna). Kirim va chiqimda birlik tanlanadi, qoldiq asosiy birlikda yuritiladi.
- **Teskari hisob:** hujjat qatorida "QQSsiz" yoki "Jami" summasi yozilsa, miqdor va QQS stavkasidan 1 birlik narxi o'zi hisoblanadi.
- **Davrni yopish:** yopilgan oygacha bo'lgan hujjat, xarajat va to'lovlarni o'zgartirib bo'lmaydi (bulutda server ham tekshiradi).

## 4-versiyada qo'shilganlar

- **Buxgalteriya bo'limi:** 21-BHMS schyotlar rejasi (335 ta schyot), buxgalter qo'shadigan subschyotlar (masalan 5110.01), boshlang'ich qoldiqlar, qo'lda operatsiyalar, provodkalar jurnali, aylanma-saldo vedomosti, schyot kartochkasi, buxgalteriya balansi (1-shakl qatorlari bilan).
- **Provodkalar avtomatik emas:** har bir hujjat, xarajat, to'lov va asosiy vositada "Taklif qilinganini qo'yish" tugmasi bor; buxgalter schyotlarni tekshirib, o'zi saqlaydi. Provodkasiz yozuvlar ro'yxati alohida ko'rsatiladi.
- **Kirim-chiqim tahlili:** har bir mahsulot qatori bo'yicha filtr (davr, hujjat turi, nom, MXIK, o'lchov, ombor, kontragent, QQS turi, narx va summa oralig'i), mahsulot bo'yicha jamlash, Excel.
- **Sayt adminlari:** bosh admin adminlar qo'shadi va huquq beradi (buxgalterlar, yangilik/reklama/kalendar, soliq stavkalari, firmalarni ko'rish).
- **Yangiliklar va reklama:** faqat faol yozuv bo'lsa ko'rinadi; reklama muddati va auditoriyasi (hamma yoki tanlangan buxgalterlar) bilan.
- **Soliq kalendari:** muddatlar (bir martalik yoki har oy/chorak/yil takrorlanadigan), eslatma oynasi, qo'ng'iroqcha belgisi, sahifa tepasida ogohlantirish, brauzer bildirishnomalari (sayt ochiq bo'lganda).
- **Boshlang'ich qoldiq (ombor)** hujjati: tovar qoldiqlarini tannarxi bilan kiritish.
- Bulut rejimi uchun `supabase/schema.sql` yangilandi (avvalgi bazaga qayta ishga tushirish mumkin).

## 5-versiyada qo'shilganlar

- Soliq kalendarida bir kunga istalgancha muddat qo'shish mumkin (kun ustiga sichqoncha olib borilsa "+ qo'shish" chiqadi).
- Kirim, sotuv va qaytarish qatorlarida **"Belgi"** katagi: buxgalter o'zi uchun so'z yoki raqam yozadi; Kirim-chiqim tahlilida shu bo'yicha filtrlanadi.
- Sotuv va xaridordan qaytish qatorlarida majburiy **"Faoliyat turi"**: o'zi ishlab chiqargan, oldi-sotdi, xizmat ko'rsatish, ishtirok etmaydi. Hujjat tepasida barcha qatorlarga birdan qo'yish mumkin.
- **Statistika** bo'limi: faoliyat turlari bo'yicha sof tushum, tannarx, yalpi foyda va rentabellik (davr va oylar bo'yicha, Excel).

## 6-versiya

- Yangilik, reklama va soliq kalendari muddatlari lotin alifbosida kiritiladi; kirill alifbosida avtomatik ko'rinadi (forma ostida kirillcha ko'rinishi chiqadi). Ruscha matn uchun alohida kataklar bor; bo'sh qolsa rus tilida o'zbekcha matn ko'rsatiladi.

## 7-versiya

- Hujjat qatorlarida mahsulot tanlangandan keyin ixtiyoriy **"Nomi"** katagi chiqadi (masalan, "Navoiy karyeri"); u Excel va Kirim-chiqim tahlilida ko'rinadi va qidiriladi.
- Mahsulot kartochkasida MXIK tanlanganda buxgalter yozgan nom endi o'chib ketmaydi. Bitta MXIK kodga bir nechta mahsulot ochish mumkin, har birining qoldig'i alohida yuritiladi.

## 9-versiya: hujjat biriktirish
- Asosiy vosita, xarajat va to'lov kartasiga PDF va rasmlarni biriktirish (bir nechta fayl, sudrab tashlash, telefondan suratga olish).
- Avtomatik siqish: rasm uzun tomoni 2000 px gacha, JPEG 80%; 1 MB dan katta PDF sahifalari 150 dpi rasmga aylantirilib qayta yig'iladi (25% dan kam tejalsa asli qoladi). Siqilgandan keyin bitta fayl 10 MB gacha.
- Jadvallarda 📎 ustuni: nechta hujjat biriktirilgani.
- Bulut: fayllar Supabase Storage'dagi yopiq `hujjatlar` omborida (`firma/yozuv/fayl`), ro'yxati `files` jadvalida; kirish huquqi firmaga qarab. Yangilash uchun `supabase/yangilash-hujjatlar.sql` ni bir marta ishga tushiring.
- Yozuv, firma yoki buxgalter o'chirilsa, uning fayllari ham o'chadi.
- Tuzatildi: asosiy vosita ochilganda "Asosiy vosita schyoti" maydoniga jamg'arilgan eskirish summasi tushib qolardi.

## 10-versiya: mahsulot nomi va MXIK kodi alohida
- Kalkulyatsiyada mahsulot nomi, MXIK kodi va o'lchov birligi alohida maydonlarda. Bitta MXIK kodda bir nechta mahsulot (Lotok 3 m, Lotok 6 m), har birining qoldig'i, tannarxi va kalkulyatsiyasi alohida.
- "Boshqa o'lcham uchun nusxa": kalkulyatsiyani homashyo va xarajatlari bilan yangi mahsulotga ko'chiradi.
- Mahsulot kartasida "Nusxa olish (boshqa o'lcham/tur)" tugmasi.
- Bir xil nomli ikkita mahsulot ochib bo'lmaydi (katta-kichik harf va ortiqcha bo'shliq hisobga olinmaydi).
- Hujjat qatoridagi "Qo'shimcha nom" faqat yorliq: qoldig'i alohida kerak bo'lsa alohida mahsulot ochiladi.

## 11-versiya: Bank (hisob raqam) va hisob-fakturalar
- Yangi "Bank (hisob raqam)" bo'limi: bank orqali kirim va chiqimlar, har qatordan keyingi qoldiq, davr boshiga va oxiriga qoldiq (boshlang'ich qoldiq 51xx schyotlaridan olinadi), sana/yo'nalish/kontragent/faktura holati bo'yicha filtr, Excel.
- Har bir to'lov uchun hisob-faktura holati: kirimda "faktura yuborilgan", chiqimda "faktura qabul qilingan", qisman yoki fakturasiz (avans). To'lovlar kontragent hujjatlariga (sotuv, kirim, xarajat, asosiy vosita) sana tartibida avtomatik bog'lanadi.
- To'lov kartasida: "Avtomatik", "Faktura bor (tizimga kiritilmagan)" (raqam va sana bilan) yoki "Faktura talab qilinmaydi" (soliq, ish haqi, qarz).
- "Fakturalar bo'yicha to'lovlar" yorlig'i: har bir faktura to'langan, qisman yoki to'lanmaganligi va qaysi to'lovlar bilan yopilgani.
- Xarajatda (kontragentsiz) "Qanday to'langan: bank / naqd" maydoni; bankdan to'langanlari bank harakatida ko'rinadi.

## Ma'lum cheklovlar (keyingi yangilanishlar uchun)

- Excel**dan** import hali yo'q (Excelga eksport bor).
- Yuklangan MXIK fayllarida faqat tovar guruhlari (002–097) bor; xizmatlar MXIK kodlari kerak bo'lsa, ularning faylini ham qo'shamiz.
- Katalog nomlari kirillda; lotin rejimida avtomatik lotinga o'giriladi, rus rejimida o'zbekcha kirillda qoladi.
- Telefon yopiq yoki sayt ochilmagan paytda keladigan push-bildirishnoma uchun alohida server (Web Push) kerak; hozir eslatmalar sayt ochilganda va ochiq turganda chiqadi.
- "Bitta login — bitta qurilma" tekshiruvi har daqiqada ishlaydi: ikkinchi qurilmadan kirilganda birinchisi chiqarib yuboriladi.
- Hisob-kitoblar yordamchi vosita. Deklaratsiya uchun yakuniy javobgarlik buxgalterda.
