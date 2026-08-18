'use strict';

// ---------------------------------------------------------------------------
// Ангилал
// ---------------------------------------------------------------------------
const categories = [
  { slug: 'shampoo',      name: 'Шампунь',              kind: 'hair', icon: 'bottle', sort: 1 },
  { slug: 'conditioner',  name: 'Кондиционер ба маск',  kind: 'hair', icon: 'jar',    sort: 2 },
  { slug: 'hair-care',    name: 'Үсний тос ба ийлдэс',  kind: 'hair', icon: 'drop',   sort: 3 },
  { slug: 'hair-color',   name: 'Үсний будаг',          kind: 'hair', icon: 'tube',   sort: 4 },
  { slug: 'styling',      name: 'Хэлбэржүүлэгч',        kind: 'hair', icon: 'spray',  sort: 5 },
  { slug: 'hair-tools',   name: 'Үсний багаж',          kind: 'hair', icon: 'tool',   sort: 6 },
  { slug: 'gel',          name: 'Гель лак',             kind: 'nail', icon: 'polish', sort: 7 },
  { slug: 'polish',       name: 'Энгийн лак',           kind: 'nail', icon: 'polish', sort: 8 },
  { slug: 'base-top',     name: 'Бааз ба топ',          kind: 'nail', icon: 'polish', sort: 9 },
  { slug: 'nail-care',    name: 'Хумсны арчилгаа',      kind: 'nail', icon: 'drop',   sort: 10 },
  { slug: 'nail-tools',   name: 'Хумсны багаж',         kind: 'nail', icon: 'tool',   sort: 11 },
];

// ---------------------------------------------------------------------------
// Бүтээгдэхүүн — үнэ бүгд ₮ (MNT)
// ---------------------------------------------------------------------------
const products = [
  // ---- Шампунь ----
  { sku: 'SH-001', name: 'Кератин сэргээгч шампунь 500мл', brand: 'Lumière Pro', category: 'shampoo',
    price: 68000, compare_price: 82000, stock: 46, hue: 268, shape: 'bottle', badge: 'Хямдрал',
    rating: 4.8, sold: 312, volume: '500 мл',
    short: 'Гэмтсэн, будсан үсийг гүнзгий сэргээх кератин найрлагатай мэргэжлийн шампунь.',
    description: 'Салон дахь кератин эмчилгээний үр дүнг гэртээ хадгалахад зориулагдсан. Сульфатгүй зөөлөн суурь нь толгойн арьсыг хатаалгүйгээр цэвэрлэж, гидролиз кератин үсний ширхэгийн гэмтсэн хэсгийг нөхөж, өнгийг 8 хүртэл долоо хоног барина.',
    howto: 'Норгосон үсэндээ 2 удаа түрхэж, толгойн арьсаа зөөлөн массаж хийн 2 минут байлгаад бүлээн усаар угаана.',
    ingredients: 'Aqua, Cocamidopropyl Betaine, Hydrolyzed Keratin, Argan Oil, Panthenol, Glycerin' },

  { sku: 'SH-002', name: 'Тослог үсэнд зориулсан цэвэршүүлэгч шампунь 400мл', brand: 'Herba Mongol', category: 'shampoo',
    price: 42000, stock: 63, hue: 152, shape: 'bottle', badge: '',
    rating: 4.6, sold: 208, volume: '400 мл',
    short: 'Хайлаас, хамхуулын ханд бүхий тослог үсэнд тохирсон хөнгөн шампунь.',
    description: 'Монголын уулын ургамлын ханд дээр суурилсан найрлага нь толгойн арьсны тос ялгаралтыг тэнцвэржүүлж, үсийг 3 дахин удаан цэвэр байлгана. Өдөр бүр хэрэглэхэд тохиромжтой.',
    howto: 'Өдөр бүр эсвэл хоног дамжуулан хэрэглэнэ. Толгойн арьсанд төвлөрүүлэн массаж хийнэ.',
    ingredients: 'Aqua, Sodium Cocoyl Isethionate, Urtica Dioica Extract, Menthol, Zinc PCA' },

  { sku: 'SH-003', name: 'Хайрсжилтын эсрэг эмчилгээний шампунь 300мл', brand: 'DermaCare', category: 'shampoo',
    price: 55000, stock: 38, hue: 205, shape: 'bottle', badge: '',
    rating: 4.7, sold: 176, volume: '300 мл',
    short: 'Пиритион цайр агуулсан, хайрсжилт ба загатнааг 7 хоногт намдаана.',
    description: 'Толгойн арьсны мөөгөнцрийн үржлийг саатуулж, хуурайшилт, загатнааг эрс бууруулна. Арьс мэдрэг хүмүүст ч тохиромжтой, үнэр багатай.',
    howto: '7 хоногт 2-3 удаа хэрэглэнэ. Түрхээд 3 минут байлгана.',
    ingredients: 'Aqua, Zinc Pyrithione 1%, Salicylic Acid, Allantoin, Bisabolol' },

  { sku: 'SH-004', name: 'Ягаан хөх өнгө саармагжуулагч шампунь 250мл', brand: 'Blonde Studio', category: 'shampoo',
    price: 74000, stock: 24, hue: 285, shape: 'bottle', badge: 'Шинэ',
    rating: 4.9, sold: 94, volume: '250 мл',
    short: 'Цайруулсан үсний шаргал өнгийг устгаж, хүйтэн платинум өнгө өгнө.',
    description: 'Өндөр агууламжтай ягаан хөх пигмент нь цайруулсан болон буурал үсний шаргал өнгийг саармагжуулна. Салоны түвшний үр дүнг 5 минутанд.',
    howto: '7 хоногт 1-2 удаа. Үр дүнгээс хамааруулан 3-5 минут байлгана. Бээлий хэрэглэнэ үү.',
    ingredients: 'Aqua, Violet Pigment CI 60730, Hydrolyzed Silk, Camellia Oil' },

  // ---- Кондиционер ба маск ----
  { sku: 'CN-001', name: 'Гүн эрчимжүүлэгч үсний маск 300мл', brand: 'Lumière Pro', category: 'conditioner',
    price: 79000, compare_price: 95000, stock: 41, hue: 22, shape: 'jar', badge: 'Хямдрал',
    rating: 4.9, sold: 401, volume: '300 мл',
    short: 'Аргана тос, шиа тос агуулсан 5 минутын эрчимжүүлэгч маск.',
    description: 'Хуурайшсан, хэврэг үсийг нэг хэрэглэснээр зөөлөн, гялалзсан болгоно. Салонд хийдэг эмчилгээний найрлагыг гэрийн нөхцөлд хялбар хэрэглэх боломжтой болгосон.',
    howto: 'Угаасны дараа илүүдэл усыг шахаж, үзүүрээс нь эхлэн түрхэнэ. 5-10 минут байлгаад зайлна.',
    ingredients: 'Aqua, Cetearyl Alcohol, Argania Spinosa Oil, Butyrospermum Parkii, Amodimethicone' },

  { sku: 'CN-002', name: 'Өдөр тутмын зөөлрүүлэгч кондиционер 400мл', brand: 'Herba Mongol', category: 'conditioner',
    price: 46000, stock: 72, hue: 96, shape: 'bottle', badge: '',
    rating: 4.5, sold: 233, volume: '400 мл',
    short: 'Хөнгөн бүтэцтэй, үсийг дарахгүйгээр самнахад хялбар болгоно.',
    description: 'Улаан лийрийн ханд, В5 витамин агуулсан өдөр тутмын кондиционер. Статик цэнэгийг арилгаж, үс сэвсийхээс сэргийлнэ.',
    howto: 'Шампуниар угаасны дараа үсний дунд хэсгээс үзүүр хүртэл түрхэж, 2 минутын дараа зайлна.',
    ingredients: 'Aqua, Behentrimonium Chloride, Panthenol, Lavandula Extract' },

  { sku: 'CN-003', name: 'Зайлахгүй тослог тун (leave-in) 150мл', brand: 'Silk & Shine', category: 'conditioner',
    price: 52000, stock: 55, hue: 330, shape: 'spray', badge: 'Эрэлттэй',
    rating: 4.7, sold: 288, volume: '150 мл',
    short: 'Салхи, хүйтний нөлөөнөөс хамгаалах, зайлах шаардлагагүй тос.',
    description: '10 үйлчилгээ нэг лонхонд: зөөлрүүлэх, гялалзуулах, дулаанаас хамгаалах, самнахад хялбар болгох. Монголын хуурай, хүйтэн уур амьсгалд тусгайлан тохируулсан.',
    howto: 'Чийгтэй эсвэл хуурай үсэнд 3-5 удаа шүршиж, самнана. Зайлахгүй.',
    ingredients: 'Aqua, Cyclopentasiloxane, Hydrolyzed Wheat Protein, Vitamin E' },

  // ---- Үсний тос ба ийлдэс ----
  { sku: 'HC-001', name: 'Аргана тосны гялбаа ийлдэс 100мл', brand: 'Silk & Shine', category: 'hair-care',
    price: 63000, stock: 49, hue: 38, shape: 'drop', badge: 'Эрэлттэй',
    rating: 4.9, sold: 512, volume: '100 мл',
    short: 'Хөнгөн, тослог үлдээхгүй, шууд гялалзуулах үйлчилгээтэй.',
    description: 'Марокко гаралтай 100% цэвэр аргана тос. Хагарсан үзүүрийг нөхөж, үсний ширхэгийг гялалзуулна. Ганцхан дусал хангалттай.',
    howto: '1-2 дусал алган дээрээ түрхэж, үсний дунд болон үзүүрт түрхэнэ.',
    ingredients: 'Argania Spinosa Kernel Oil, Cyclopentasiloxane, Tocopherol' },

  { sku: 'HC-002', name: 'Үс ургалт идэвхжүүлэх ампул 12x8мл', brand: 'DermaCare', category: 'hair-care',
    price: 128000, compare_price: 149000, stock: 18, hue: 178, shape: 'drop', badge: 'Хямдрал',
    rating: 4.6, sold: 87, volume: '12 x 8 мл',
    short: 'Кофеин, биотин, пептид агуулсан 12 хоногийн эрчимт эмчилгээ.',
    description: 'Үс унах явцыг сааруулж, шинэ ширхэгийн ургалтыг дэмжинэ. Эмнэлзүйн туршилтаар 8 долоо хоногт үсний нягтшил 24% нэмэгдсэн.',
    howto: 'Өдөрт 1 ампул. Цэвэр толгойн арьсанд түрхэж 1 минут массаж хийнэ. Зайлахгүй.',
    ingredients: 'Caffeine, Biotin, Copper Tripeptide-1, Niacinamide, Panthenol' },

  { sku: 'HC-003', name: 'Толгойн арьсны хальсархуулагч скраб 200мл', brand: 'DermaCare', category: 'hair-care',
    price: 58000, stock: 33, hue: 118, shape: 'jar', badge: '',
    rating: 4.5, sold: 121, volume: '200 мл',
    short: 'Далайн давс, цайны модны тосоор толгойн арьсыг гүн цэвэрлэнэ.',
    description: 'Хуримтлагдсан лак, тос, үхмэл эсийг зөөлөн зайлуулж, толгойн арьсыг амьсгалуулна. Долоо хоногт нэг удаагийн зайлшгүй алхам.',
    howto: 'Норгосон толгойн арьсанд түрхэж, 3 минут массаж хийгээд шампуниар угаана.',
    ingredients: 'Sea Salt, Melaleuca Alternifolia Oil, Menthol, Glycerin' },

  // ---- Үсний будаг ----
  { sku: 'CL-001', name: 'Мэргэжлийн крем будаг 6.0 Байгалийн бор', brand: 'Colorista', category: 'hair-color',
    price: 34000, stock: 88, hue: 25, shape: 'tube', badge: '',
    rating: 4.7, sold: 640, volume: '100 мл',
    short: 'Аммиак багатай, 100% буурал бүрхэх мэргэжлийн будаг.',
    description: 'Салоны стандартын крем будаг. Тэнцвэртэй пигмент нь жигд өнгө өгч, 6 долоо хоног хүртэл тогтоно. Оксидант тусад нь худалдаалагдана.',
    howto: '1:1.5 харьцаагаар оксидантай хольж, хуурай үсэнд түрхэн 35 минут байлгана.',
    ingredients: 'Cetearyl Alcohol, Ammonium Hydroxide (low), Resorcinol-free' },

  { sku: 'CL-002', name: 'Мэргэжлийн крем будаг 7.43 Зэсэн алт', brand: 'Colorista', category: 'hair-color',
    price: 34000, stock: 54, hue: 30, shape: 'tube', badge: 'Эрэлттэй',
    rating: 4.8, sold: 421, volume: '100 мл',
    short: 'Дулаан зэс-алтан өнгө, өндөр гялбаатай.',
    description: 'Улирлын хамгийн эрэлттэй өнгө. Зэсэн улаавтар пигмент нь наранд гялалзсан эффект өгнө.',
    howto: '1:1.5 харьцаагаар 6% оксидантай хольж 35 минут байлгана.',
    ingredients: 'Cetearyl Alcohol, Copper pigment complex, Argan Oil' },

  { sku: 'CL-003', name: 'Оксидант 9% (30 vol) 1000мл', brand: 'Colorista', category: 'hair-color',
    price: 22000, stock: 96, hue: 200, shape: 'bottle', badge: '',
    rating: 4.6, sold: 380, volume: '1000 мл',
    short: 'Тогтвортой найрлагатай кремэн оксидант, будаг болон цайруулагчид.',
    description: 'Жигд исэлдэлт өгч, үсний гэмтлийг бууруулна. Бүх крем будагтай нийцнэ.',
    howto: 'Будагтай 1:1.5, цайруулагчтай 1:2 харьцаагаар холино.',
    ingredients: 'Hydrogen Peroxide 9%, Cetearyl Alcohol, Glycerin' },

  { sku: 'CL-004', name: 'Цайруулагч нунтаг Blue Bleach 500г', brand: 'Blonde Studio', category: 'hair-color',
    price: 68000, stock: 29, hue: 215, shape: 'jar', badge: '',
    rating: 4.7, sold: 198, volume: '500 г',
    short: '7 түвшин хүртэл цайруулах, тоос үүсгэдэггүй найрлага.',
    description: 'Хөх саармагжуулагчтай тул шаргал өнгө үлдээхгүй. Тоос үүсгэхгүй нарийн бүтэц нь ажиллахад тав тухтай.',
    howto: 'Оксидантай 1:2 харьцаагаар холино. 50 минутаас хэтрүүлэхгүй.',
    ingredients: 'Potassium Persulfate, Blue Pigment, Kaolin' },

  // ---- Хэлбэржүүлэгч ----
  { sku: 'ST-001', name: 'Дулаанаас хамгаалах шүршигч 200мл', brand: 'Silk & Shine', category: 'styling',
    price: 48000, stock: 67, hue: 190, shape: 'spray', badge: '',
    rating: 4.8, sold: 356, volume: '200 мл',
    short: '230°C хүртэл дулаанаас хамгаална.',
    description: 'Индүү, сэнс, гогцоо хэрэглэхийн өмнөх заавал алхам. Үсэнд хамгаалалтын нимгэн бүрхүүл үүсгэж, чийгийг барина.',
    howto: 'Хуурай эсвэл чийгтэй үснээс 20см зайд шүршинэ.',
    ingredients: 'Aqua, PVP, Hydrolyzed Keratin, Panthenol' },

  { sku: 'ST-002', name: 'Хүчтэй бэхлэгч лак 400мл', brand: 'Silk & Shine', category: 'styling',
    price: 39000, stock: 74, hue: 348, shape: 'spray', badge: '',
    rating: 4.6, sold: 290, volume: '400 мл',
    short: 'Хөшүүн болгохгүй, самнахад амархан хүчтэй бэхэлгээ.',
    description: 'Хурим, арга хэмжээний засалд тохирсон удаан барих лак. Чийгэнд тэсвэртэй, цагаан үлдэгдэл үүсгэхгүй.',
    howto: '30см зайд шүршинэ. Давхарлан хэрэглэж болно.',
    ingredients: 'Alcohol Denat, VP/VA Copolymer, Aminomethyl Propanol' },

  { sku: 'ST-003', name: 'Матт заслын шавар 100мл', brand: 'Barber Line', category: 'styling',
    price: 44000, stock: 45, hue: 210, shape: 'jar', badge: '',
    rating: 4.7, sold: 167, volume: '100 мл',
    short: 'Эрэгтэй заслын гялбаагүй өнгөлгөөтэй, дунд зэрэг бэхэлгээ.',
    description: 'Гялбаагүй байгалийн харагдац өгч, өдөржин хэлбэрээ хадгална. Усанд уусдаг тул угаахад хялбар.',
    howto: 'Хуурай үсэнд бага хэмжээгээр алган дээрээ түрхэж, хэлбэржүүлнэ.',
    ingredients: 'Aqua, Kaolin, Beeswax, Ceteareth-25' },

  // ---- Үсний багаж ----
  { sku: 'TL-001', name: 'Мэргэжлийн ионтой сэнс 2400W', brand: 'AeroPro', category: 'hair-tools',
    price: 385000, compare_price: 450000, stock: 12, hue: 260, shape: 'tool', badge: 'Хямдрал',
    rating: 4.9, sold: 76, volume: '2400W',
    short: 'AC мотор, ион үүсгэгч, 2 хошуу, 3 дулаан / 2 хурд.',
    description: 'Салонд өдөр тутам ашиглахад зориулсан AC мотортой сэнс. Ионы технологи нь статик цэнэгийг арилгаж хатаах хугацааг 40% богиносгоно. 2 жилийн баталгаа.',
    howto: 'Хүйтэн агаарын товчийг заслын төгсгөлд ашиглан хэлбэрийг бэхжүүлнэ.',
    ingredients: '2 жилийн албан ёсны баталгаа. 220V.' },

  { sku: 'TL-002', name: 'Титан хавтгай индүү 230°C', brand: 'AeroPro', category: 'hair-tools',
    price: 245000, stock: 21, hue: 300, shape: 'tool', badge: '',
    rating: 4.8, sold: 143, volume: '25мм хавтан',
    short: 'Титан бүрхүүл, 15 секундэд халах, хөвдөг хавтан.',
    description: 'Жигд дулаан тархалт нь нэг удаагийн гүйлтээр шулуун болгоно. Хөвдөг хавтан нь үсийг татахгүй.',
    howto: 'Дулаанаас хамгаалах шүршигч хэрэглэсний дараа хуурай үсэнд ашиглана.',
    ingredients: '220V, автомат унтрах систем (60 мин).' },

  { sku: 'TL-003', name: 'Мэргэжлийн үс хайчлах хайч 6 инч', brand: 'Barber Line', category: 'hair-tools',
    price: 165000, stock: 26, hue: 220, shape: 'tool', badge: '',
    rating: 4.7, sold: 92, volume: '6 инч',
    short: 'Япон 440C ган, тохируулгатай эрэг.',
    description: 'Мэргэжлийн үсчинд зориулсан хурц, тэнцвэртэй хайч. Эргономик бариул нь удаан ажиллахад бугуйг ядраахгүй.',
    howto: 'Ашигласны дараа арчиж, тосолно.',
    ingredients: 'Japanese 440C stainless steel.' },

  { sku: 'TL-004', name: 'Дугуй сойзон сам (керамик, 53мм)', brand: 'AeroPro', category: 'hair-tools',
    price: 42000, stock: 58, hue: 40, shape: 'tool', badge: '',
    rating: 4.6, sold: 214, volume: '53 мм',
    short: 'Керамик хоолой, байгалийн хялгас — гялбаа өгнө.',
    description: 'Хатаах явцад эзэлхүүн, гялбаа өгнө. Керамик хоолой нь дулааныг жигд тарааж хэлбэрийг удаан барина.',
    howto: 'Сэнстэй хамт үсний зангилааг сунган хатаана.',
    ingredients: 'Ceramic barrel, natural + nylon bristles.' },

  // ---- Гель лак ----
  { sku: 'GL-001', name: 'Гель лак #012 Сарнайн улаан 10мл', brand: 'Polished', category: 'gel',
    price: 26000, stock: 84, hue: 350, shape: 'polish', badge: 'Эрэлттэй',
    rating: 4.9, sold: 726, volume: '10 мл',
    short: 'Нэг давхаргаар бүрэн бүрхэх, 21 хоног тогтоно.',
    description: 'Өтгөн пигменттэй тул нэг давхарга хангалттай. LED дэнлүүнд 30 секундэд хатна. Цуврал 60 өнгөтэй.',
    howto: 'Бааз, өнгө (2 давхарга), топ. Давхарга бүрийг LED-д 30 сек хатаана.',
    ingredients: 'HEMA-free formula, Acrylates Copolymer, Pigments' },

  { sku: 'GL-002', name: 'Гель лак #034 Сүү цагаан 10мл', brand: 'Polished', category: 'gel',
    price: 26000, stock: 91, hue: 45, shape: 'polish', badge: '',
    rating: 4.8, sold: 588, volume: '10 мл',
    short: 'Френч болон нюд заслын үндсэн өнгө.',
    description: 'Жигд, судалгүй түрхэгддэг сүүн цагаан. Френч заслын хамгийн их эрэлттэй өнгө.',
    howto: 'Нимгэн 2 давхарга түрхэнэ. Тус бүрийг 30 сек хатаана.',
    ingredients: 'HEMA-free formula, Titanium Dioxide, Acrylates' },

  { sku: 'GL-003', name: 'Гель лак #077 Шөнийн хөх 10мл', brand: 'Polished', category: 'gel',
    price: 26000, stock: 47, hue: 232, shape: 'polish', badge: '',
    rating: 4.7, sold: 341, volume: '10 мл',
    short: 'Гүн, баялаг хөх өнгө, өвлийн цуглуулга.',
    description: 'Гүн далайн хөх өнгө нь арьсны бүх өнгөнд зохимжтой. Өндөр гялбаатай.',
    howto: 'Бааз, 2 давхарга өнгө, топ дарааллаар түрхэнэ.',
    ingredients: 'HEMA-free formula, Ultramarine, Acrylates' },

  { sku: 'GL-004', name: 'Гель лак багц — Нюд 6 өнгө', brand: 'Polished', category: 'gel',
    price: 138000, compare_price: 156000, stock: 22, hue: 20, shape: 'set', badge: 'Багц',
    rating: 4.9, sold: 164, volume: '6 x 10 мл',
    short: 'Хамгийн эрэлттэй 6 нюд өнгө хэмнэлттэй багцаар.',
    description: 'Салонд хамгийн их захиалагддаг 6 өнгийн багц: сүү цагаан, беж, ягаан беж, какао, чихрийн ягаан, бор.',
    howto: 'Багц бүр 10мл савтай. LED 30 сек.',
    ingredients: 'HEMA-free formula.' },

  { sku: 'GL-005', name: 'Гель лак #101 Хром эффект 10мл', brand: 'Glitz Lab', category: 'gel',
    price: 32000, stock: 36, hue: 285, shape: 'polish', badge: 'Шинэ',
    rating: 4.8, sold: 128, volume: '10 мл',
    short: 'Толин гадаргуутай хром эффект.',
    description: 'Металл толин гялбаатай онцгой найрлага. Дан хэрэглэж болно, нунтаг шаардлагагүй.',
    howto: 'Хар баазан дээр 1 давхарга түрхэж, топ дарна.',
    ingredients: 'Aluminium powder, Acrylates Copolymer' },

  // ---- Энгийн лак ----
  { sku: 'NP-001', name: 'Хурдан хатдаг лак — Улаан хилэн 12мл', brand: 'Polished', category: 'polish',
    price: 16000, stock: 76, hue: 355, shape: 'polish', badge: '',
    rating: 4.5, sold: 402, volume: '12 мл',
    short: '60 секундэд хатах, 10-free найрлага.',
    description: '10-free: формальдегид, толуол, DBP зэрэг хортой бодисгүй. Дэнлүү шаардлагагүй.',
    howto: 'Бааз түрхээд 2 давхарга өнгө, дараа нь топ.',
    ingredients: '10-free formula, Butyl Acetate, Nitrocellulose' },

  { sku: 'NP-002', name: 'Хурдан хатдаг лак — Пастел ягаан 12мл', brand: 'Polished', category: 'polish',
    price: 16000, stock: 82, hue: 335, shape: 'polish', badge: '',
    rating: 4.5, sold: 356, volume: '12 мл',
    short: 'Зөөлөн пастел ягаан, өдөр тутмын өнгө.',
    description: 'Хөнгөн пастел ягаан. 2 давхаргаар бүрэн бүрхэнэ.',
    howto: 'Бааз, 2 давхарга, топ.',
    ingredients: '10-free formula.' },

  { sku: 'NP-003', name: 'Гялтганаат лак — Алтан тоос 12мл', brand: 'Glitz Lab', category: 'polish',
    price: 19000, stock: 44, hue: 48, shape: 'polish', badge: '',
    rating: 4.6, sold: 187, volume: '12 мл',
    short: 'Нягт алтан гялтгануур, шинэ жилийн эрэлттэй.',
    description: 'Нарийн ба бүдүүн гялтгануурын хослол. Дан эсвэл өнгөн дээр давхарлан хэрэглэнэ.',
    howto: 'Өнгөт лакны дээр 1 давхарга түрхэнэ.',
    ingredients: 'Polyester glitter, Nitrocellulose' },

  // ---- Бааз ба топ ----
  { sku: 'BT-001', name: 'Резинэн бааз гель 15мл', brand: 'Polished', category: 'base-top',
    price: 34000, stock: 68, hue: 40, shape: 'polish', badge: 'Эрэлттэй',
    rating: 4.9, sold: 615, volume: '15 мл',
    short: 'Хумсыг тэгшилж, лакны бариулалтыг 2 дахин нэмэгдүүлнэ.',
    description: 'Уян хатан резин найрлага нь хумсны хонхорхойг тэгшилж, гель лак хугарахаас сэргийлнэ. Нимгэн хумсанд бэхжүүлэгч болно.',
    howto: 'Хумсаа файлдаж, тослогийг арчсаны дараа нимгэн түрхэж 60 сек хатаана.',
    ingredients: 'Acrylates Copolymer, HEMA-free' },

  { sku: 'BT-002', name: 'Наалдацгүй топ гель (No-wipe) 15мл', brand: 'Polished', category: 'base-top',
    price: 34000, stock: 59, hue: 195, shape: 'polish', badge: '',
    rating: 4.8, sold: 540, volume: '15 мл',
    short: 'Арчих шаардлагагүй, шилэн гялбаатай.',
    description: 'Хатсаны дараа наалдамхай давхарга үлдээхгүй тул цаг хэмнэнэ. Шар болдоггүй UV шүүлтүүртэй.',
    howto: 'Сүүлийн давхаргад түрхэж LED-д 60 сек хатаана.',
    ingredients: 'Acrylates, UV filter' },

  { sku: 'BT-003', name: 'Матт топ гель 15мл', brand: 'Glitz Lab', category: 'base-top',
    price: 36000, stock: 31, hue: 265, shape: 'polish', badge: '',
    rating: 4.7, sold: 219, volume: '15 мл',
    short: 'Хилэн мэт гялбаагүй өнгөлгөө.',
    description: 'Ямар ч өнгийг зөөлөн, гялбаагүй болгоно. Хосолмол заслын үндэс.',
    howto: 'Өнгө хатсаны дараа 1 давхарга түрхэж 60 сек хатаана.',
    ingredients: 'Acrylates, Silica' },

  // ---- Хумсны арчилгаа ----
  { sku: 'NC-001', name: 'Хумсны хальс зөөлрүүлэгч тос 15мл', brand: 'Polished', category: 'nail-care',
    price: 18000, stock: 93, hue: 15, shape: 'drop', badge: '',
    rating: 4.8, sold: 470, volume: '15 мл',
    short: 'Жожоба, Е витамин агуулсан, бийрэн үзүүртэй.',
    description: 'Хуурайшсан хумсны хальсыг зөөлрүүлж, хумс хугарахаас сэргийлнэ. Өдөрт 2 удаа хэрэглэхэд 7 хоногт үр дүн мэдэгдэнэ.',
    howto: 'Хумсны ёзоор дээр түрхэж массаж хийнэ.',
    ingredients: 'Jojoba Oil, Tocopherol, Sweet Almond Oil' },

  { sku: 'NC-002', name: 'Хумс бэхжүүлэгч кальцийн тун 12мл', brand: 'DermaCare', category: 'nail-care',
    price: 24000, stock: 51, hue: 168, shape: 'polish', badge: '',
    rating: 4.6, sold: 203, volume: '12 мл',
    short: 'Нимгэн, хугардаг хумсанд 14 хоногийн эмчилгээ.',
    description: 'Кальци, кератин, биотины найрлага нь хумсны бүтцийг сэргээж, давхаргалахаас сэргийлнэ.',
    howto: 'Өдөр бүр 1 давхарга нэмж түрхэнэ. 7 хоног тутам арилгана.',
    ingredients: 'Calcium Pantothenate, Hydrolyzed Keratin, Biotin' },

  { sku: 'NC-003', name: 'Гель арилгагч (ацетон) 500мл', brand: 'Polished', category: 'nail-care',
    price: 21000, stock: 87, hue: 205, shape: 'bottle', badge: '',
    rating: 4.5, sold: 512, volume: '500 мл',
    short: 'Мэргэжлийн цэвэр ацетон, 10 минутад гелийг зөөлрүүлнэ.',
    description: 'Салоны хэрэглээнд зориулсан 500мл сав. Хумсны хиймэл наалт болон гель лак арилгахад.',
    howto: 'Хөвөнд шингээж хумсанд тавиад тугалган цаасаар боож 10 минут байлгана.',
    ingredients: 'Acetone 100%' },

  // ---- Хумсны багаж ----
  { sku: 'NT-001', name: 'LED/UV хатаагч дэнлүү 72W', brand: 'Glitz Lab', category: 'nail-tools',
    price: 145000, compare_price: 175000, stock: 19, hue: 275, shape: 'tool', badge: 'Хямдрал',
    rating: 4.8, sold: 158, volume: '72W',
    short: '36 диод, хөдөлгөөн мэдрэгч, 4 таймер.',
    description: 'Хоёр гарт зэрэг тохирох өргөн танхим. 10/30/60/99 секундын горим. Нүдэнд ээлтэй сарнисан гэрэл.',
    howto: 'Гараа оруулахад автоматаар асна.',
    ingredients: '220V, 2 жилийн баталгаа.' },

  { sku: 'NT-002', name: 'Хумсны фрезер аппарат 35000 эрг/мин', brand: 'Glitz Lab', category: 'nail-tools',
    price: 268000, stock: 14, hue: 240, shape: 'tool', badge: '',
    rating: 4.7, sold: 64, volume: '35000 RPM',
    short: 'Чимээ багатай, чичиргээгүй мотор, 6 хошуутай.',
    description: 'Мэргэжлийн маникюр, педикюрийн аппарат. Хоёр чиглэлд эргэх, дижитал заалттай.',
    howto: 'Хошуугаа сольж, хурдаа тохируулна. Ажилласны дараа халдваргүйжүүлнэ.',
    ingredients: '6 x carbide/ceramic bit орсон.' },

  { sku: 'NT-003', name: 'Маникюрын багаж иж бүрдэл 12ш', brand: 'Barber Line', category: 'nail-tools',
    price: 89000, stock: 27, hue: 210, shape: 'tool', badge: '',
    rating: 4.6, sold: 112, volume: '12 ширхэг',
    short: 'Зэвэрдэггүй ган, савтай иж бүрдэл.',
    description: 'Хайч, хямсаа, түлхэгч, файл зэрэг мэргэжлийн 12 багаж. Автоклавд халдваргүйжүүлж болно.',
    howto: 'Хэрэглэсний дараа халдваргүйжүүлэгч уусмалд 10 минут байлгана.',
    ingredients: 'Stainless steel 420.' },

  { sku: 'NT-004', name: 'Хумсны файл багц 100/180 (10ш)', brand: 'Polished', category: 'nail-tools',
    price: 15000, stock: 120, hue: 330, shape: 'tool', badge: '',
    rating: 4.5, sold: 634, volume: '10 ширхэг',
    short: 'Хоёр талт, угаагаад дахин ашиглаж болно.',
    description: 'Салонд өдөр тутам ашиглах хосолсон ширхэгтэй файл. 100 грит — хэлбэржүүлэх, 180 грит — өнгөлөх.',
    howto: 'Нэг чиглэлд файлдана.',
    ingredients: 'Washable, sanitizable.' },
];

// ---------------------------------------------------------------------------
// Урамшууллын код
// ---------------------------------------------------------------------------
const promos = [
  { code: 'SHINE10', type: 'percent', value: 10,   min_total: 50000,  active: 1, note: 'Бүх бараанд 10% хөнгөлөлт' },
  { code: 'GOY20',   type: 'percent', value: 20,   min_total: 200000, active: 1, note: '200,000₮-с дээш захиалгад 20%' },
  { code: 'HUR8',    type: 'amount',  value: 8000, min_total: 0,      active: 1, note: 'Хүргэлтийн үнэ хасагдана' },
];

// ---------------------------------------------------------------------------
// Сэтгэгдлийн жишээ
// ---------------------------------------------------------------------------
const reviewTexts = [
  ['Маш сайхан бүтээгдэхүүн байна. Салондоо тогтмол хэрэглэж байгаа.', 5, 'Б. Сарантуяа'],
  ['Хүргэлт хурдан, савлагаа нь эмх цэгцтэй ирсэн. Баярлалаа.', 5, 'Э. Номин'],
  ['Үнэ нь бага зэрэг өндөр ч чанартаа тохирч байна.', 4, 'Г. Хулан'],
  ['Найзууддаа санал болгосон. Үр дүн нь мэдэгдэхүйц.', 5, 'Д. Мөнхзул'],
  ['Хэрэглээд 2 долоо хоног боллоо, одоохондоо сэтгэл хангалуун.', 4, 'Ц. Ариунаа'],
  ['Жинхэнэ бүтээгдэхүүн. Дахин захиална.', 5, 'Н. Оюунчимэг'],
];

module.exports = { categories, products, promos, reviewTexts };
