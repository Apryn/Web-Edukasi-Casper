import type { Course } from "./types.ts";

export const coursesData: Course[] = [
  {
    id: "c1",
    slug: "trading-fundamentals",
    number: "SC-01",
    title: "Trading Fundamentals",
    subtitle: "Membangun Fondasi Berpikir dan Cara Kerja Pasar Keuangan",
    category: "Trading Foundation",
    level: "Beginner",
    duration: "2.5 Jam",
    totalLessons: 6,
    featured: true,
    instructor: {
      name: "Casper Market Research",
      role: "Lead Trading Analyst",
    },
    overview:
      "Sebelum menekan tombol buy atau sell, setiap trader harus memahami siapa saja pelaku pasar, bagaimana likuiditas mengalir, dan mengapa 90% trader retail kehilangan modal akibat ekspektasi yang keliru. Kursus ini adalah fondasi paling krusial.",
    objectives: [
      "Memahami mekanisme order flow antara pembeli dan penjual di pasar finansial",
      "Mengenal instrumen utama (Forex, Komoditas Emas, Indeks) dan karakternya",
      "Membedakan mentalitas spekulan pemula vs probabilitas trader institusi",
      "Mengenal terminologi inti: Bid, Ask, Spread, Leverage, Margin, dan Pip/Point",
    ],
    prerequisites: ["Kemauan belajar tanpa mencari jalan pintas 'cepat kaya'"],
    modules: [
      {
        id: "m1-1",
        title: "Modul 1: Anatomi Pasar Finansial",
        description: "Membongkar siapa lawan transaksi Anda di pasar global.",
        lessons: [
          {
            id: "l1-1",
            slug: "bagaimana-pasar-bergerak",
            title: "Bagaimana Harga Bergerak: Mekanisme Likuiditas",
            duration: "12 Menit",
            type: "reading",
            summary: "Harga bukan bergerak karena garis indikator, melainkan ketidakseimbangan agresif antara order beli dan jual.",
            content: [
              "Banyak trader pemula mengira harga naik karena indikator Stochastic atau RSI berada di level tertentu. Ini adalah kekeliruan fatal. Harga bergerak semata-mata karena adanya ketidakseimbangan order antara pembeli agresif (market buy) dan penjual agresif (market sell).",
              "Ketika order beli dalam volume besar menyerap seluruh limit sell yang tersedia pada harga tertentu, harga terpaksa melompat ke tingkatan harga berikutnya untuk mencari likuiditas baru. Inilah esensi pergerakan harga.",
              "Di pasar derivatif dan forex, partisipan terbagi menjadi: Bank Sentral, Bank Komersial Besar (Tier 1 Liquidity Providers), Dana Lindung Nilai (Hedge Funds), dan trader retail. Memahami posisi kita sebagai retail adalah langkah pertama melindungi modal.",
            ],
            keyTakeaways: [
              "Pasar adalah mekanisme lelang pencari likuiditas.",
              "Indikator hanyalah turunan matematis dari harga historis, bukan penggerak harga.",
              "Jangan pernah trading melawan likuiditas besar institusional.",
            ],
          },
          {
            id: "l1-2",
            slug: "leverage-dan-margin-realitas",
            title: "Leverage & Margin: Pedang Bermata Dua",
            duration: "15 Menit",
            type: "reading",
            summary: "Memahami mengapa leverage tinggi adalah penyebab utama margin call bagi pemula.",
            content: [
              "Leverage adalah daya ungkit modal pinjaman yang diberikan broker kepada trader. Dengan leverage 1:100, modal $1,000 memungkinkan Anda mengontrol kontrak senilai $100,000.",
              "Namun, leverage memperbesar persentase kerugian sama cepatnya dengan potensi keuntungan. Kerugian 1% pada posisi leverage penuh akan menghabisi 100% modal akun Anda.",
              "Trader profesional memandang leverage bukan sebagai alat untuk mempercepat untung besar, melainkan fasilitas efisiensi modal sambil tetap membatasi risiko maksimal 1% - 2% dari saldo per transaksi.",
            ],
            keyTakeaways: [
              "Margin adalah jaminan minimum yang ditahan broker untuk menjaga posisi tetap terbuka.",
              "Margin Call terjadi ketika kerugian menggerus margin hingga batas kritis broker.",
              "Selalu hitung ukuran lot berdasarkan batas toleransi kerugian nominal dalam dollar, bukan berdasarkan besaran leverage.",
            ],
          },
          {
            id: "l1-3",
            slug: "kuis-fondasi-pasar",
            title: "Kuis Evaluasi: Mekanisme Pasar & Risiko",
            duration: "10 Menit",
            type: "quiz",
            summary: "Uji pemahaman Anda tentang likuiditas, leverage, dan eksekusi order.",
            content: [
              "Jawab 3 pertanyaan berikut untuk memastikan Anda telah menguasai konsep dasar pergerakan harga sebelum melangkah ke analisis teknikal.",
            ],
            quiz: [
              {
                id: "q1-1",
                question: "Apa yang menyebabkan pergerakan harga terjadi di pasar finansial?",
                options: [
                  "Garis moving average yang saling bersilangan",
                  "Ketidakseimbangan antara volume order beli dan jual yang menyerap likuiditas",
                  "Jam buka pasar sesi London dan New York semata",
                  "Algoritma broker yang menggeser harga secara acak",
                ],
                correctAnswer: 1,
                explanation: "Harga bergerak karena ketidakseimbangan order lelang. Indikator hanya mencerminkan apa yang sudah terjadi pada pergerakan harga tersebut.",
              },
              {
                id: "q1-2",
                question: "Bagaimana cara trader profesional memanfaatkan leverage?",
                options: [
                  "Menggunakan leverage setinggi mungkin untuk melipatgandakan modal dalam semalam",
                  "Menghindari stop loss karena leverage tinggi bisa menahan fluktuasi harga",
                  "Menggunakan leverage untuk efisiensi modal, namun tetap membatasi risiko per transaksi 1-2% dari akun",
                  "Hanya membuka posisi saat leverage 1:1000 tersedia",
                ],
                correctAnswer: 2,
                explanation: "Profesional mengontrol risiko nominal dalam dollar (1-2% modal), sehingga leverage tinggi tidak membuat akun rentan margin call.",
              },
              {
                id: "q1-3",
                question: "Kapan risiko likuiditas paling tinggi terjadi bagi retail trader?",
                options: [
                  "Saat rilis berita ekonomi 'High Impact' seperti US Non-Farm Payrolls karena pelebaran spread dan slippage",
                  "Di tengah overlap sesi London dan New York",
                  "Saat menggunakan chart timeframe harian (D1)",
                  "Ketika pasar sedang berada dalam kondisi trending sehat",
                ],
                correctAnswer: 0,
                explanation: "Saat rilis berita berdampak besar, likuiditas bisa mengering seketika, menyebabkan spread melebar ekstrem dan order dieksekusi dengan slippage besar.",
              },
            ],
          },
        ],
      },
      {
        id: "m1-2",
        title: "Modul 2: Siklus & Jam Perdagangan Global",
        description: "Mengetahui kapan volatilitas terjadi dan kapan pasar sebaiknya dihindari.",
        lessons: [
          {
            id: "l1-4",
            slug: "sesi-perdagangan-global",
            title: "Karakteristik 3 Sesi Utama: Asia, London, New York",
            duration: "14 Menit",
            type: "reading",
            summary: "Setiap sesi memiliki kepribadian, likuiditas, dan jebakan manipulasi yang berbeda.",
            content: [
              "Pasar finansial berjalan 24 jam sehari selama hari kerja, berpindah dari sesi Asia (Tokyo/Sydney), sesi Eropa (London), hingga sesi Amerika (New York).",
              "Sesi Asia umumnya bergerak dalam rentang (range) terbatas karena likuiditas yang lebih rendah, sering kali membentuk likuiditas high/low yang akan disapu pada sesi berikutnya.",
              "Sesi London adalah pusat likuiditas mata uang utama dan emas. Pembukaan London sering memicu pergerakan palsu (Judas Swing) sebelum tren sejati terbentuk.",
              "Overlapping antara Sesi London dan New York (pukul 19:00 - 23:00 WIB) adalah jendela waktu dengan volume dan volatilitas tertinggi di dunia.",
            ],
            keyTakeaways: [
              "Jangan trading sembarangan di luar sesi aktif instrumen Anda.",
              "Overlap London-New York menawarkan pergerakan paling terarah.",
              "High dan Low sesi Asia sering menjadi target likuiditas trader institusi.",
            ],
          },
          {
            id: "l1-5",
            slug: "video-mekanisme-likuiditas-pasar",
            title: "Video Panduan: Visualisasi Order Flow & Sesi Pasar",
            duration: "16 Menit",
            type: "video",
            summary: "Simulasi video bagaimana order market menyapu likuiditas resting orders di pasar derivatif global.",
            content: [
              "Dalam video pembelajaran ini, kita mendemonstrasikan secara visual apa yang terjadi di balik layar Depth of Market (Order Book) ketika bank sentral atau institusi besar melakukan akumulasi aset.",
              "Perhatikan bagaimana spread melebar saat transisi sesi perdagangan dan bagaimana ritme pergerakan harga berubah drastis saat pembukaan sesi London.",
            ],
            videoUrl: "https://www.youtube.com/embed/b13a7c6oG1s",
            videoDuration: "16:24",
            keyTakeaways: [
              "Order book adalah representasi limit order pasif di pasar.",
              "Market order agresif adalah motor penggerak harga melintasi spread bid-ask.",
              "Hindari membuka posisi tepat di detik pembukaan sesi karena spread sering melebar.",
            ],
          },
          {
            id: "l1-6",
            slug: "kuis-evaluasi-akhir-fundamentals",
            title: "Kuis Akhir Kelulusan: Trading Fundamentals",
            duration: "15 Menit",
            type: "quiz",
            summary: "Kuis komprehensif penentu kelulusan kelas Trading Fundamentals (Batas kelulusan: 70%).",
            content: [
              "Selesaikan evaluasi akhir ini untuk menguji seluruh konsep likuiditas, manajemen modal, dan karakteristik sesi pasar sebelum beralih ke analisis teknikal.",
            ],
            quiz: [
              {
                id: "q1-6-1",
                question: "Kapan jendela waktu dengan likuiditas dan volume tertinggi di pasar finansial global?",
                options: [
                  "Sesi Asia pagi hari pukul 06:00 - 09:00 WIB",
                  "Overlapping sesi London dan New York (pukul 19:00 - 23:00 WIB)",
                  "Tepat tengah malam setelah penutupan sesi New York",
                  "Saat pasar akhir pekan hari Sabtu dan Minggu",
                ],
                correctAnswer: 1,
                explanation: "Overlap London dan New York mempertemukan dua pusat keuangan terbesar di dunia sehingga volume dan volatilitas mencapai puncak tertingginya.",
              },
              {
                id: "q1-6-2",
                question: "Jika trader memiliki saldo $10,000 dan berpegang pada aturan manajemen risiko 1% per transaksi, berapa dollar risiko maksimal per trade?",
                options: [
                  "$10",
                  "$500",
                  "$100",
                  "$1,000",
                ],
                correctAnswer: 2,
                explanation: "1% dari $10,000 adalah $100. Stop loss harus dihitung sedemikian rupa sehingga jika tersentuh, kerugian tidak lebih dari $100.",
              },
              {
                id: "q1-6-3",
                question: "Apa fungsi utama stop loss dalam perencanaan transaksi?",
                options: [
                  "Membuat broker bisa mengambil keuntungan trader",
                  "Membatasi risiko kerugian terukur jika hipotesis pasar terbukti keliru",
                  "Menjamin akun tidak akan pernah mengalami drawdown",
                  "Mempercepat target take profit tercapai",
                ],
                correctAnswer: 1,
                explanation: "Stop loss adalah sabuk pengaman trading yang mengeksekusi cut-loss otomatis ketika skenario analisis kita tidak valid.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "c2",
    slug: "candlestick-price-action",
    number: "SC-02",
    title: "Candlestick & Price Action",
    subtitle: "Membaca Narasi Perilaku Pasar dari Bentuk Candle dan Wick",
    category: "Technical Analysis",
    level: "Beginner",
    duration: "3 Jam",
    totalLessons: 7,
    featured: true,
    instructor: {
      name: "Casper Market Research",
      role: "Lead Trading Analyst",
    },
    overview:
      "Banyak orang menghafal nama-nama pola candle seperti Doji, Engulfing, atau Hammer tanpa memahami apa yang sebenarnya terjadi di balik tubuh dan sumbu lilin tersebut. Di kursus ini, Anda belajar membaca cerita psikologis pembeli dan penjual dari setiap candlestick.",
    objectives: [
      "Membongkar anatomi candlestick: Open, High, Low, Close (OHLC)",
      "Memahami arti panjang tubuh (body) vs panjang sumbu (wick/shadow)",
      "Mengenal konfirmasi penolakan harga (rejection) di level kunci",
      "Menghindari kesalahan umum entry hanya karena melihat 1 candle tanpa konteks tren",
    ],
    prerequisites: ["Telah menyelesaikan Trading Fundamentals"],
    modules: [
      {
        id: "m2-1",
        title: "Modul 1: Anatomi dan Bahasa Candlestick",
        description: "Menafsirkan momentum dan perebutan kendali pembeli vs penjual.",
        lessons: [
          {
            id: "l2-1",
            slug: "anatomi-ohlc-dan-cerita-dibaliknya",
            title: "Membongkar OHLC: Siapa yang Memegang Kendali?",
            duration: "15 Menit",
            type: "reading",
            summary: "Candle bukan sekadar warna hijau atau merah, melainkan rekam jejak dominasi kekuatan dalam kurun waktu tertentu.",
            content: [
              "Candlestick Jepang merangkum 4 titik harga: Harga Pembukaan (Open), Titik Tertinggi (High), Titik Terendah (Low), dan Penutupan (Close).",
              "Panjang tubuh (body) mencerminkan seberapa kuat momentum pihak pemenang. Candle bullish panjang dengan sumbu minimal menandakan pembeli mendominasi dari awal hingga akhir periode.",
              "Sebaliknya, sumbu panjang (wick) mencerminkan area di mana harga sempat diterima namun kemudian ditolak keras oleh kekuatan lawan transaksi.",
            ],
            keyTakeaways: [
              "Body tebal = Momentum kuat.",
              "Wick panjang = Penolakan harga (Rejection).",
              "Candle kecil di area resisten = Hilangnya momentum (Exhaustion).",
            ],
          },
          {
            id: "l2-2",
            slug: "studi-chart-pinbar-dan-engulfing",
            title: "Studi Kasus: Rejection Pinbar vs False Breakout",
            duration: "18 Menit",
            type: "chart-study",
            summary: "Analisis visual bagaimana sumbu candle menyapu stop loss sebelum harga berbalik arah.",
            content: [
              "Pinbar atau hammer sering kali dianggap sinyal pembalikan arah langsung. Namun jika terjadi di tengah range tanpa level acuan, kemungkinan gagalnya sangat besar.",
              "Pinbar berkualitas tinggi terjadi saat harga menembus level penting, memicu order stop loss retail (liquidity sweep), lalu ditutup kembali dengan cepat di dalam rentang normal.",
            ],
            chartData: {
              title: "XAUUSD H4 Rejection Pinbar di Support 2650.00",
              description: "Harga menembus false break level 2650, menyerap order sell stop, dan ditutup dengan wick bawah 60 pips sebelum rally 180 pips.",
              timeframe: "H4",
              bias: "Bullish",
            },
          },
          {
            id: "l2-3",
            slug: "kuis-candlestick-action",
            title: "Kuis: Membaca Sumbu dan Momentum Candle",
            duration: "10 Menit",
            type: "quiz",
            summary: "Uji kepekaan membaca intensi candle di chart.",
            content: [
              "Jawab pertanyaan berikut untuk mengevaluasi pemahaman Anda mengenai penolakan harga dan momentum candlestick.",
            ],
            quiz: [
              {
                id: "q2-1",
                question: "Sebuah candlestick memiliki body kecil di bagian bawah dan wick atas yang sangat panjang (3x body). Apa narasi psikologinya?",
                options: [
                  "Pembeli sangat dominan dan harga siap menembus rekor baru",
                  "Pembeli sempat mendorong harga tinggi, namun penjual masuk secara agresif dan menolak kenaikan harga tersebut",
                  "Pasar sedang tidak ada transaksi sama sekali",
                  "Ini adalah sinyal pasti buy",
                ],
                correctAnswer: 1,
                explanation: "Wick atas yang panjang menunjukkan harga sempat naik tinggi tetapi ditolak keras oleh penjual sebelum periode ditutup.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "c3",
    slug: "market-structure",
    number: "SC-03",
    title: "Market Structure Mastery",
    subtitle: "Membaca Peta Besar: HH, HL, LH, LL, Break of Structure & Change of Character",
    category: "Market Structure",
    level: "Intermediate",
    duration: "4 Jam",
    totalLessons: 8,
    featured: true,
    instructor: {
      name: "Casper Market Research",
      role: "Lead Trading Analyst",
    },
    overview:
      "Struktur market adalah kompas utama seorang trader profesional. Tanpa memahami struktur, Anda akan terus terperangkap membeli di puncak harga atau menjual di titik terendah. Di kelas ini, Anda belajar memetakan Higher High, Higher Low, Break of Structure (BOS), dan Change of Character (CHoCH).",
    objectives: [
      "Mengidentifikasi swing high dan swing low valid (bukan sekadar noise)",
      "Memahami aturan baku Break of Structure (BOS)",
      "Mengenal sinyal awal pembalikan tren: Change of Character (CHoCH)",
      "Menerapkan multi-timeframe analysis: mengawinkan struktur H4/D1 dengan eksekusi M15",
    ],
    prerequisites: ["Telah memahami Candlestick & Price Action"],
    modules: [
      {
        id: "m3-1",
        title: "Modul 1: Swing Points & Struktur Tren",
        description: "Menentukan titik acuan struktural yang diakui oleh algoritma institusi.",
        lessons: [
          {
            id: "l3-1",
            slug: "definisi-swing-high-low-valid",
            title: "Swing High & Swing Low yang Valid",
            duration: "16 Menit",
            type: "reading",
            summary: "Banyak trader salah menandai swing point karena terdistraksi candle minor di time frame kecil.",
            content: [
              "Tren naik (Uptrend) didefinisikan secara mekanis oleh rangkaian Higher High (HH) dan Higher Low (HL). Selama harga gagal menembus HL valid sebelumnya, tren naik tetap utuh.",
              "Sebuah titik hanya sah disebut Higher High baru setelah terjadi 'Inducement' atau penembusan yang ditutup dengan body candle (bukan hanya wick tipis) di atas puncak sebelumnya.",
            ],
            keyTakeaways: [
              "Struktur harus divalidasi oleh penutupan body candle pada timeframe acuan.",
              "Selalu tandai titik struktur dari timeframe tinggi (HTF) terlebih dahulu.",
            ],
          },
          {
            id: "l3-2",
            slug: "bos-vs-choch",
            title: "BOS (Break of Structure) vs CHoCH (Change of Character)",
            duration: "20 Menit",
            type: "chart-study",
            summary: "Perbedaan esensial antara kelanjutan tren dan indikasi awal pembalikan arah pasar.",
            content: [
              "Break of Structure (BOS) adalah konfirmasi bahwa tren yang sedang berlangsung berlanjut. Dalam uptrend, BOS terjadi saat harga menembus Higher High sebelumnya.",
              "Change of Character (CHoCH) adalah perubahan karakter harga pertama kali: ketika harga dalam uptrend menembus Higher Low terakhir yang valid. Ini adalah peringatan dini bahwa pembeli mulai kehilangan dominasi.",
            ],
            chartData: {
              title: "Contoh CHoCH pada XAUUSD Timeframe H1",
              description: "Harga mencetak LL pertama setelah rally panjang, mengonfirmasi pergeseran bias dari Bullish ke Bearish.",
              timeframe: "H1",
              bias: "Bearish",
            },
          },
          {
            id: "l3-3",
            slug: "kuis-market-structure",
            title: "Kuis: Validasi Struktur & Perubahan Tren",
            duration: "10 Menit",
            type: "quiz",
            summary: "Uji ketepatan Anda dalam membedakan BOS dan CHoCH.",
            content: [
              "Pastikan Anda dapat mengenali kapan sebuah tren masih berlanjut dan kapan tren telah kehilangan strukturnya.",
            ],
            quiz: [
              {
                id: "q3-1",
                question: "Dalam tren turun (downtrend), apa yang menandai terjadinya Break of Structure (BOS)?",
                options: [
                  "Harga menembus Lower Low sebelumnya ke arah bawah",
                  "Harga membentuk wick panjang ke atas",
                  "Indikator RSI menembus angka 50",
                  "Harga menembus Lower High ke arah atas",
                ],
                correctAnswer: 0,
                explanation: "Dalam tren turun, kelanjutan struktur (BOS) ditandai dengan ditembusnya Lower Low sebelumnya oleh harga baru yang lebih rendah.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "c4",
    slug: "support-and-resistance",
    number: "SC-04",
    title: "Support & Resistance Dinamis",
    subtitle: "Mengidentifikasi Zona Reaksi Nyata, SBR/RBS, dan Likuiditas Level",
    category: "Technical Analysis",
    level: "Beginner",
    duration: "2 Jam",
    totalLessons: 5,
    instructor: {
      name: "Casper Market Research",
      role: "Lead Trading Analyst",
    },
    overview:
      "Support dan Resistance bukan sekadar satu garis tipis di mana harga wajib memantul. Di pasar modern, level kunci adalah sebuah zona harga di mana terjadi konsentrasi order pending. Pelajari cara menggambar zona reaksi yang akurat.",
    objectives: [
      "Mengganti konsep garis tunggal menjadi zona probabilitas",
      "Memahami konsep Support Become Resistance (SBR) dan sebaliknya (RBS)",
      "Menghindari jebakan membeli tepat sebelum level support ditembus",
    ],
    prerequisites: ["Telah memahami Candlestick & Price Action"],
    modules: [
      {
        id: "m4-1",
        title: "Modul 1: Pemetaan Zona Reaksi Kunci",
        description: "Menemukan area di mana pergerakan besar sebelumnya bermula.",
        lessons: [
          {
            id: "l4-1",
            slug: "zona-vs-garis",
            title: "Mengapa Level Berupa Zona, Bukan Garis Tunggal",
            duration: "14 Menit",
            type: "reading",
            summary: "Penyebab trader retail sering terkena slippage dan stop hunt pada garis support kaku.",
            content: [
              "Pasar finansial dihuni jutaan trader dengan level harga bid/ask yang berbeda. Mengharapkan harga menyentuh angka eksak desimal adalah kekeliruan fatal.",
              "Zona support dan resistance dibentuk dari rentang pembukaan hingga ekstrim sumbu candle pembalikan sebelumnya.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "c5",
    slug: "technical-analysis-framework",
    number: "SC-05",
    title: "Technical Analysis Framework",
    subtitle: "Menyusun Indikator dan Konfluensi Menjadi Sistem Trading Teruji",
    category: "Technical Analysis",
    level: "Intermediate",
    duration: "3.5 Jam",
    totalLessons: 7,
    instructor: {
      name: "Casper Market Research",
      role: "Lead Trading Analyst",
    },
    overview:
      "Terlalu banyak indikator hanya menghasilkan kelumpuhan analisis (analysis paralysis). Kursus ini mengajarkan Anda membatasi alat bantu pada 2-3 elemen yang saling melengkapi: Trend, Momentum, dan Volatilitas.",
    objectives: [
      "Membangun checklist konfluensi sebelum membuka posisi",
      "Menggunakan Moving Average sebagai pengukur dinamika tren, bukan sinyal buy/sell buta",
      "Mengatur layout chart yang bersih dan mudah dibaca secara objektif",
    ],
    prerequisites: ["Market Structure Mastery"],
    modules: [
      {
        id: "m5-1",
        title: "Modul 1: Membangun Sistem Trading Objektif",
        description: "Aturan jika-maka (if-then) untuk menghilangkan keraguan.",
        lessons: [
          {
            id: "l5-1",
            slug: "checklist-konfluensi",
            title: "The 3-Point Confluence Rule",
            duration: "16 Menit",
            type: "reading",
            summary: "Hanya ambil posisi saat struktur, level zona, dan price action mengonfirmasi arah yang sama.",
            content: [
              "Trading bukanlah aktivitas tebak-tebakan. Sebuah setup trading yang berkualitas harus memiliki setidaknya 3 faktor pendukung independen.",
              "Contoh: (1) Struktur HTF Bullish, (2) Harga berada di Zona Support Diskon, (3) Candle konfirmasi Rejection di LTF.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "c6",
    slug: "xauusd-market-analysis",
    number: "SC-06",
    title: "XAUUSD Market Analysis",
    subtitle: "Spesialisasi Pasar Emas: Karakteristik, Korelasi DXY, dan Jam Likuiditas",
    category: "Specialized Asset",
    level: "Advanced",
    duration: "4.5 Jam",
    totalLessons: 9,
    featured: true,
    instructor: {
      name: "Casper Market Research",
      role: "Lead Trading Analyst",
    },
    overview:
      "Gold (XAUUSD) adalah salah satu instrumen paling likuid dan volatil di dunia. Pergerakannya sangat dipengaruhi oleh data makro AS (NFP, CPI, FOMC), sentimen geopolitik, dan indeks dollar (DXY). Di kelas spesialis ini, Anda membedah DNA unik pasar emas.",
    objectives: [
      "Memahami hubungan terbalik antara US Dollar Index (DXY) dan Emas",
      "Mengantisipasi lonjakan spread dan slippage saat rilis berita ekonomi berdampak tinggi",
      "Mengetahui zona waktu terbaik transaksi XAUUSD (US Session Overlap)",
      "Menghitung ukuran lot emas dengan benar: nilai 1 lot standar = $100 per pip pergerakan",
    ],
    prerequisites: ["Market Structure", "Risk Management"],
    modules: [
      {
        id: "m6-1",
        title: "Modul 1: DNA & Makroekonomi Emas",
        description: "Memahami mengapa emas bergerak ribuan pips dalam hitungan jam.",
        lessons: [
          {
            id: "l6-1",
            slug: "karakteristik-volatilitas-xauusd",
            title: "Karakteristik Volatilitas Emas: Rata-Rata Daily Range (ADR)",
            duration: "18 Menit",
            type: "reading",
            summary: "XAUUSD dapat bergerak 200 hingga 500 pips dalam satu hari normal. Mengetahui batas harian menyelamatkan Anda dari overtrading.",
            content: [
              "Berbeda dengan pasangan mata uang biasa seperti EURUSD yang bergerak rata-rata 60-80 pips per hari, XAUUSD secara konsisten memiliki Average Daily Range (ADR) di atas 250 pips.",
              "Artinya, stop loss pada emas memerlukan ruang bernapas yang proporsional. Stop loss 10 pips yang wajar di mata uang sering kali mudah tersapu oleh noise di pasar emas.",
              "Faktor penggerak utama emas adalah suku bunga riil AS, imbal hasil obligasi pemerintah (US Treasury Yields), dan permintaan lindung nilai safe haven global.",
            ],
            keyTakeaways: [
              "Nilai 1 pip pada emas berbobot signifikan, sesuaikan ukuran lot lebih kecil.",
              "Perhatikan jadwal berita NFP, CPI, dan suku bunga The Fed (FOMC).",
              "Sesi New York (19.00 - 23.00 WIB) adalah jam paling aktif bagi pergerakan XAUUSD.",
            ],
          },
          {
            id: "l6-2",
            slug: "korelasi-dxy-dan-xauusd",
            title: "Korelasi Terbalik Emas dan US Dollar Index (DXY)",
            duration: "20 Menit",
            type: "chart-study",
            summary: "Mengapa Anda tidak boleh menganalisis emas tanpa membuka chart DXY secara bersamaan.",
            content: [
              "Karena emas dihargakan dalam US Dollar (XAU/USD), penguatan dollar secara umum menekan harga emas, dan sebaliknya pelemahan dollar mendorong apresiasi emas.",
              "Namun, pada kondisi krisis geopolitik ekstrem, korelasi ini bisa terputus di mana baik dollar maupun emas sama-sama menguat sebagai instrumen pelindung nilai.",
            ],
            chartData: {
              title: "Divergensi DXY vs XAUUSD H4",
              description: "Saat DXY mencetak Higher High namun gagal menekan XAUUSD ke Lower Low, terjadi indikasi akumulasi beli institusi pada emas.",
              timeframe: "H4",
              bias: "Bullish",
            },
          },
          {
            id: "l6-3",
            slug: "kuis-spesialisasi-emas",
            title: "Kuis: Spesialisasi Pasar XAUUSD",
            duration: "10 Menit",
            type: "quiz",
            summary: "Uji kesiapan Anda menghadapi pasar paling volatil.",
            content: [
              "Uji pemahaman Anda tentang perhitungan kontrak emas, korelasi DXY, dan rilis berita ekonomi.",
            ],
            quiz: [
              {
                id: "q6-1",
                question: "Jika Anda trading 0.10 lot standar pada XAUUSD, berapa nilai keuntungan/kerugian per 10 pips ($1.00 per troy oz)?",
                options: [
                  "$1.00",
                  "$10.00",
                  "$100.00",
                  "$0.10",
                ],
                correctAnswer: 1,
                explanation: "Pada lot 0.10 XAUUSD, setiap pergerakan $1.00 pada harga emas (10 pips) bernilai nominal tepat $10.00.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "c7",
    slug: "risk-management",
    number: "SC-07",
    title: "Risk Management & Capital Preservation",
    subtitle: "Aturan Matematika Bertahan Hidup: Risk-Reward, Position Sizing, dan Drawdown",
    category: "Risk & Psychology",
    level: "Beginner",
    duration: "2.5 Jam",
    totalLessons: 6,
    featured: true,
    instructor: {
      name: "Casper Market Research",
      role: "Lead Trading Analyst",
    },
    overview:
      "Anda bisa memiliki win rate 80%, tetapi satu transaksi tanpa manajemen risiko bisa menghabiskan seluruh akun Anda. Di kelas ini, Anda mempelajari matematika bertahan hidup di pasar: rumus lot size otomatis, Risk-to-Reward Ratio (RRR), dan cara mengelola drawdown beruntun.",
    objectives: [
      "Menguasai kalkulator posisi berdasarkan jarak stop loss dan batas toleransi modal",
      "Memahami mengapa Risk-to-Reward minimum 1:2 memungkinkan Anda profit meski win rate hanya 40%",
      "Menyusun aturan cut-off harian untuk menghentikan efek spiral balas dendam (revenge trading)",
    ],
    prerequisites: ["Trading Fundamentals"],
    modules: [
      {
        id: "m7-1",
        title: "Modul 1: Matematika Probabilitas dan Lot Sizing",
        description: "Mengapa persentase risiko lebih penting daripada mencari akurasi 100%.",
        lessons: [
          {
            id: "l7-1",
            slug: "rumus-position-sizing-akurat",
            title: "Rumus Baku Position Sizing: Jangan Pernah Menggunakan Lot Tebak-Tebakan",
            duration: "16 Menit",
            type: "reading",
            summary: "Ukuran lot harus dihitung mundur dari jarak stop loss, bukan ditentukan secara tetap.",
            content: [
              "Kesalahan paling fatal trader pemula adalah selalu menggunakan ukuran lot tetap (misal selalu 0.5 lot) tanpa mempedulikan jarak stop loss.",
              "Jika jarak stop loss Anda 50 pips, lot harus lebih kecil dibanding ketika stop loss Anda hanya 20 pips, agar jumlah kerugian nominal tetap konsisten (misal tepat $20 pada setiap transaksi loss).",
              "Rumus dasar: Lot = (Modal Akun × % Risiko) / (Jarak Stop Loss dalam Pips × Nilai per Pip).",
            ],
            keyTakeaways: [
              "Nominal risiko harus konsisten pada setiap transaksi.",
              "Jangan pernah menambah posisi yang sedang merugi (Martingale).",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "c8",
    slug: "trading-psychology",
    number: "SC-08",
    title: "Trading Psychology & Discipline",
    subtitle: "Mengatasi FOMO, Revenge Trading, Overconfidence, dan Rasa Takut Rugi",
    category: "Risk & Psychology",
    level: "Intermediate",
    duration: "2.5 Jam",
    totalLessons: 5,
    instructor: {
      name: "Casper Market Research",
      role: "Lead Trading Analyst",
    },
    overview:
      "Market adalah cermin emosi manusia: keserakahan (greed) dan ketakutan (fear). Kursus ini membongkar jebakan psikologis yang dialami setiap trader dan bagaimana para profesional melatih pikiran agar mampu menerima ketidakpastian tanpa stres.",
    objectives: [
      "Mengenali gejala awal 'tilt' atau emosi balas dendam setelah mengalami kerugian",
      "Menghilangkan rasa takut ketinggalan momen (FOMO) saat melihat market melonjak cepat",
      "Membangun rutinitas pra-sesi trading yang tenang dan objektif",
    ],
    prerequisites: ["Risk Management"],
    modules: [
      {
        id: "m8-1",
        title: "Modul 1: Menguasai Diri Sendiri",
        description: "Transisi dari bereaksi secara emosional menjadi eksekusi berbasis sistem.",
        lessons: [
          {
            id: "l8-1",
            slug: "tidak-ada-setup-adalah-keputusan",
            title: "Tidak Ada Setup Adalah Sebuah Posisi: Seni Menunggu",
            duration: "15 Menit",
            type: "reading",
            summary: "Kemampuan menahan diri tidak membuka posisi saat kondisi pasar tidak jelas adalah keahlian tingkat tinggi.",
            content: [
              "Pasar finansial tidak membayar Anda untuk seberapa banyak transaksi yang Anda buka setiap hari. Pasar membayar Anda atas kualitas disiplin Anda.",
              "Trader pemula merasa harus selalu memiliki posisi aktif di pasar. Akibatnya, mereka memaksakan setup jelek di tengah konsolidasi noise.",
              "Duduk diam di depan chart sambil menunggu level probabilitas tinggi tercapai adalah salah satu bentuk eksekusi paling bernilai.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "c9",
    slug: "trading-journal-evaluation",
    number: "SC-09",
    title: "Trading Journal & Evaluation",
    subtitle: "Merekam, Menganalisis Data Transaksi Sendiri, dan Memperbaiki Performa",
    category: "Trading Foundation",
    level: "Intermediate",
    duration: "2 Jam",
    totalLessons: 5,
    instructor: {
      name: "Casper Market Research",
      role: "Lead Trading Analyst",
    },
    overview:
      "Apa yang tidak bisa diukur, tidak bisa diperbaiki. Semua trader sukses memiliki catatan rinci: alasan entry, kondisi psikologis saat eksekusi, screenshot sebelum dan sesudah transaksi, serta evaluasi kesalahan berkala.",
    objectives: [
      "Menyusun template jurnal trading profesional",
      "Mengevaluasi metrik kunci: Profit Factor, Expectancy, Win Rate, dan Max Drawdown",
      "Melakukan review mingguan untuk membuang setup buruk yang terus menguras modal",
    ],
    prerequisites: ["Trading Fundamentals", "Risk Management"],
    modules: [
      {
        id: "m9-1",
        title: "Modul 1: Metrik Kunci Evaluasi",
        description: "Menemukan kelemahan trading Anda dari data nyata akun Anda sendiri.",
        lessons: [
          {
            id: "l9-1",
            slug: "anatomi-jurnal-trading",
            title: "Parameter Wajib dalam Jurnal Trading",
            duration: "14 Menit",
            type: "reading",
            summary: "Bukan hanya mencatat untung atau rugi, melainkan apakah Anda mematuhi rencana awal.",
            content: [
              "Sebuah transaksi yang menghasilkan profit tetapi melanggar aturan manajemen risiko sebenarnya adalah sebuah kesalahan buruk yang beruntung.",
              "Sebaliknya, transaksi yang berakhir rugi tetapi dieksekusi 100% sesuai rencana adalah transaksi yang baik dalam kerangka probabilitas jangka panjang.",
            ],
          },
        ],
      },
    ],
  },
];

export function getCourseBySlug(slug: string): Course | undefined {
  return coursesData.find((c) => c.slug === slug);
}

export function getAllCourses(): Course[] {
  return coursesData;
}
