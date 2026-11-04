import type { Course } from "../types";

export const coursesC1C2: Course[] = [
  {
    id: "c1",
    slug: "trading-fundamentals",
    number: "SC-01",
    title: "Trading Fundamentals",
    subtitle: "Membangun Fondasi Berpikir, Mekanisme Lelang Likuiditas, dan Arsitektur Pasar Keuangan",
    category: "Trading Foundation",
    level: "Beginner",
    duration: "3.5 Jam",
    totalLessons: 6,
    featured: true,
    instructor: {
      name: "Casper Market Research",
      role: "Lead Trading Analyst",
    },
    overview:
      "Sebelum menekan tombol buy atau sell, setiap trader wajib memahami siapa saja partisipan pasar, bagaimana buku order (order book) mempertemukan likuiditas pasif dan agresif, struktur biaya transaksi (bid, ask, spread, swap, slippage), cara kerja leverage dan margin secara matematis, serta ritme sesi perdagangan global (Asia, London, New York). Kelas ini dirancang untuk membangun fondasi berpikir berbasis probabilitas dan perlindungan modal.",
    objectives: [
      "Memahami mekanisme lelang dua arah dan interaksi antara Limit Order (likuiditas pasif) serta Market Order (eksekutor harga)",
      "Menguasai perhitungan spesifikasi kontrak: Bid, Ask, Spread, Pip/Point, Nilai Kontrak, Leverage, Used Margin, dan Free Margin",
      "Membedakan struktur partisipan pasar (Bank Sentral, Tier-1 Liquidity Provider, Institutional Fund, dan Retail Trader)",
      "Memetakan karakteristik volatilitas dan likuiditas tiga sesi perdagangan utama (Asia, London, dan New York Overlap)",
    ],
    competencies: [
      "Mampu menghitung kebutuhan margin, nilai per pip, dan biaya transaksi riil sebelum mengeksekusi order apa pun",
      "Mampu mengidentifikasi jendela waktu likuiditas optimal dan menghindari jam rawan pelebaran spread serta slippage ekstrem",
      "Mampu memperlakukan aktivitas trading sebagai pengelolaan risiko berbasis probabilitas, bukan spekulasi emosional",
    ],
    prerequisites: [
      "Tidak memerlukan pengalaman trading sebelumnya",
      "Kemauan mempelajari dasar matematika risiko tanpa mencari jalan pintas keuntungan instan",
    ],
    courseSummary: [
      "Harga bergerak semata-mata karena ketidakseimbangan antara volume Market Order agresif dan ketersediaan Limit Order pasif di buku order.",
      "Spread dan slippage adalah biaya gesekan (friction cost) nyata yang wajib diperhitungkan dalam setiap perencanaan transaksi.",
      "Leverage tinggi memperkecil kebutuhan Used Margin, tetapi tidak mengubah nilai risiko per pip—kontrol risiko tetap ditentukan oleh ukuran lot dan jarak Stop Loss.",
      "Sesi perdagangan Asia cenderung membentuk rentang konsolidasi, Sesi London memicu ekspansi awal, dan Overlap London–New York menghadirkan puncak likuiditas harian.",
    ],
    references: [
      "Harris, L. (2003). Trading and Exchanges: Market Microstructure for Practitioners. Oxford University Press.",
      "Bank for International Settlements (BIS) — Triennial Central Bank Survey of Foreign Exchange and Over-the-Counter (OTC) Derivatives Markets.",
      "CME Group Educational Institute — Market Microstructure, Order Book Depth, and Liquidity Dynamics.",
    ],
    modules: [
      {
        id: "m1-1",
        title: "Modul 1: Mikrostruktur & Anatomi Pasar Finansial",
        description: "Membongkar mekanisme lelang buku order, partisipan pasar, serta realitas matematis leverage dan margin.",
        lessons: [
          {
            id: "l1-1",
            slug: "bagaimana-pasar-bergerak",
            title: "Bagaimana Harga Bergerak: Mekanisme Likuiditas & Buku Order",
            duration: "20 Menit",
            type: "reading",
            summary: "Harga bukan digerakkan oleh garis indikator, melainkan oleh penyerapan likuiditas antara order pasif dan agresif di dalam buku order.",
            learningObjectives: [
              "Menjelaskan perbedaan fungsional antara Market Order (pengonsumsi likuiditas) dan Limit Order (penyedia likuiditas)",
              "Mengidentifikasi hierarki pelaku pasar finansial global dari Bank Sentral hingga trader retail",
              "Menganalisis mengapa harga bergerak naik atau turun melalui proses penyerapan antrean order (order absorption)",
            ],
            visualDiagram: "liquidity-orderbook",
            content: [
              "Kesalahpahaman terbesar trader pemula adalah meyakini bahwa harga naik atau turun karena dua garis indikator saling bersilangan. Secara mikrostruktur pasar, indikator teknikal hanyalah rumus statistik yang dihitung dari harga masa lalu. Harga di pasar finansial bergerak melalui mekanisme lelang dua arah (continuous double auction) yang mempertemukan pembeli dan penjual di dalam buku order (Order Book / Depth of Market).",
              "Di dalam buku order, terdapat dua jenis instruksi utama: Limit Order (order pasif) dan Market Order (order agresif). Limit Buy (Bid) dipasang di bawah harga saat ini oleh pelaku pasar yang bersedia membeli jika harga turun, sedangkan Limit Sell (Ask/Offer) dipasang di atas harga saat ini oleh pelaku yang bersedia menjual di harga lebih mahal. Selisih antara harga Ask terendah dan harga Bid tertinggi disebut sebagai Spread.",
              "Harga hanya akan bergerak naik satu tick apabila masuk Market Buy (pembeli agresif) dengan volume yang cukup besar hingga menghabisi seluruh antrean Limit Sell yang tersedia pada level harga Ask saat itu. Sebaliknya, harga bergerak turun apabila volume Market Sell (penjual agresif) menguras seluruh antrean Limit Buy pada level Bid. Ketika likuiditas pasif tipis—misalnya tepat saat rilis data ekonomi makro—volume Market Order yang moderat sekalipun dapat membuat harga melompat jauh (slippage).",
              "Partisipan pasar memiliki kapasitas modal dan tujuan yang sangat berbeda: (1) Bank Sentral mengatur kebijakan moneter dan stabilitas nilai tukar, (2) Bank Investasi Tier-1 bertindak sebagai penyedia likuiditas utama (Market Maker), (3) Hedge Funds dan pengelola dana institusional mengeksekusi akumulasi atau distribusi bertahap di area likuiditas tebal, serta (4) Korporasi multinasional melakukan lindung nilai (hedging). Trader retail memiliki porsi volume yang kecil sehingga harus berfokus mengikuti jejak likuiditas institusional, bukan melawannya.",
            ],
            applicationExample:
              "Pada instrumen XAUUSD di harga Bid 2650.00 / Ask 2650.20, terdapat antrean Limit Sell sebesar 300 lot di 2650.20. Ketika sebuah institusi mengeksekusi Market Buy sebesar 500 lot, 300 lot pertama tereksekusi di 2650.20 dan sisa 200 lot terpaksa dipenuhi pada antrean Ask di atasnya (2650.35 dan 2650.50). Akibatnya, harga kuotasi langsung terdorong naik dari 2650.20 ke 2650.50.",
            caseStudy:
              "Saat pengumuman data inflasi AS (CPI) pukul 19:30 WIB, banyak penyedia likuiditas menarik sementara antrean Limit Order mereka untuk menghindari risiko sepihak. Akibatnya, buku order menjadi renggang: spread XAUUSD melebar dari 20 poin menjadi 120 poin. Trader retail yang menekan tombol Market Buy tepat pada detik pengumuman mendapatkan harga eksekusi jauh di puncak (slippage buruk) sebelum harga kembali berayun turun.",
            practicalSteps: [
              "Buka jendela Market Watch di platform trading Anda dan aktifkan kolom Bid, Ask, serta Spread secara real-time.",
              "Amati perubahan besaran spread pada tiga kondisi berbeda: siang hari sesi Asia, malam hari sesi London–New York, dan 1 menit menjelang berita ekonomi berdampak tinggi.",
              "Catat biaya spread rata-rata instrumen utama Anda sebagai komponen biaya tetap dalam rencana trading.",
            ],
            commonMistakes: [
              "Menganggap indikator yang 'overbought' otomatis memaksa harga turun, padahal Market Buy institusional masih terus menyerap antrean Ask.",
              "Menekan Market Order ukuran besar saat transisi penutupan pasar (rollover pukul 04:00–05:00 WIB) ketika likuiditas sangat tipis dan spread melebar ekstrem.",
              "Tidak membedakan harga eksekusi Buy (menggunakan harga Ask) dan harga eksekusi Sell (menggunakan harga Bid) saat menempatkan Stop Loss.",
            ],
            keyTakeaways: [
              "Pasar finansial bekerja sebagai mekanisme lelang pencari likuiditas antara Limit Order pasif dan Market Order agresif.",
              "Indikator adalah cerminan historis harga, bukan penyebab pergerakan harga.",
              "Selalu perhatikan kepadatan likuiditas dan lebar spread sebelum melakukan eksekusi.",
            ],
            quiz: [
              {
                id: "q1-1-inline-1",
                question: "Mengapa harga suatu instrumen dapat melonjak cepat disertai slippage besar tepat saat rilis berita makroekonomi berdampak tinggi?",
                options: [
                  "Karena indikator Moving Average mengalami perubahan rumus secara otomatis",
                  "Karena penyedia likuiditas menarik Limit Order pasif sementara waktu sehingga Market Order agresif harus melompati beberapa level harga untuk menemukan lawan transaksi",
                  "Karena pasar tutup sementara selama 15 menit saat berita dirilis",
                  "Karena seluruh trader retail sepakat memasang Take Profit di harga yang sama",
                ],
                correctAnswer: 1,
                explanation:
                  "Saat berita besar dirilis, likuiditas pasif (Limit Order) di buku order menipis drastis sementara Market Order melonjak, sehingga harga melompat melintasi celah harga (liquidity gap) dan menimbulkan slippage.",
              },
            ],
          },
          {
            id: "l1-2",
            slug: "leverage-dan-margin-realitas",
            title: "Leverage, Margin & Nilai Kontrak: Pedang Bermata Dua",
            duration: "22 Menit",
            type: "reading",
            summary: "Membedah hubungan matematis antara ukuran kontrak, leverage, Used Margin, Free Margin, dan Margin Level agar terhindar dari likuidasi paksa (Stop Out).",
            learningObjectives: [
              "Menghitung Nilai Kontrak (Contract Size), Nilai per Pip, dan Used Margin berdasarkan rasio leverage",
              "Membedakan Balance, Equity, Used Margin, Free Margin, dan Margin Level (%)",
              "Menjelaskan mengapa penggunaan leverage tinggi tanpa batas Stop Loss menyebabkan kehancuran modal (Margin Call / Stop Out)",
            ],
            content: [
              "Di pasar berjangka dan CFD/Forex, transaksi dilakukan dalam satuan Kontrak Standar (Standard Lot). Pada pasangan mata uang utama (seperti EURUSD), 1.00 Lot Standar setara dengan 100.000 unit mata uang dasar (sekitar nilai pergerakan $10 per pip). Pada emas (XAUUSD), 1.00 Lot Standar mewakili 100 troy ounce emas, di mana pergerakan harga sebesar $1.00 per troy ounce (10 pips standar) bernilai $100 untuk 1.00 lot, atau $10 untuk 0.10 lot, dan $1 untuk 0.01 lot (micro lot).",
              "Leverage adalah fasilitas daya ungkit yang menentukan seberapa besar jaminan (Used Margin) yang dikunci sementara oleh broker untuk membuka sebuah kontrak. Dengan rumus Used Margin = Nilai Kontrak / Leverage, membuka posisi 1.00 lot senilai $100.000 pada leverage 1:100 hanya membutuhkan Used Margin sebesar $1,000. Pada leverage 1:500, Used Margin yang dibutuhkan turun menjadi $200.",
              "Fakta matematis yang wajib dipahami adalah: rasio leverage hanya mengubah besaran Used Margin yang ditahan, tetapi SAMA SEKALI TIDAK mengubah nilai keuntungan atau kerugian per pip dari ukuran lot yang Anda buka. Baik Anda menggunakan akun ber-leverage 1:100 maupun 1:1000, posisi 0.10 lot tetap bergerak sekitar $1 per pip. Bahaya leverage tinggi muncul ketika trader tergiur menggunakan sisa Free Margin yang tampak besar untuk membuka ukuran lot berlebihan (over-leveraging).",
              "Kesehatan ketahanan akun diukur melalui persamaan: Equity = Balance + Floating Profit/Loss, dan Free Margin = Equity − Used Margin. Adapun Margin Level (%) = (Equity / Used Margin) × 100%. Apabila kerugian berjalan (floating loss) menggerus Equity hingga Margin Level jatuh menyentuh ambang Stop Out broker (misalnya 50%), sistem broker secara otomatis akan menutup paksa posisi Anda mulai dari yang mengalami kerugian terbesar.",
            ],
            applicationExample:
              "Seorang trader memiliki Balance $2,000 dengan akun leverage 1:100. Ia membuka 0.20 lot EURUSD di harga 1.0800 (Nilai kontrak = 20.000 EUR = $21,600). Used Margin yang ditahan adalah $21,600 / 100 = $216. Jika posisi tersebut sedang rugi berjalan -$40, maka Equity menjadi $1,960, Free Margin menjadi $1,960 − $216 = $1,744, dan Margin Level berada di ($1,960 / $216) × 100% = 907.4% (sangat aman).",
            caseStudy:
              "Dua trader masing-masing memiliki modal $1,000. Trader A menggunakan leverage 1:500 untuk membuka posisi penuh 1.00 lot XAUUSD ($10 per pip) tanpa Stop Loss. Ketika harga emas bergerak berlawanan arah sejauh $10 (100 pips), Equity Trader A langsung habis menjadi $0 dalam waktu 15 menit. Sebaliknya, Trader B juga memiliki leverage 1:500 tetapi membatasi risiko 1% ($10) dengan membuka 0.01 lot dan Stop Loss 100 pips. Saat harga bergerak 100 pips berlawanan arah, Trader B hanya kehilangan $10 (1%) dan masih memiliki 99% modal untuk melanjutkan rencana tradingnya.",
            practicalSteps: [
              "Hitung nilai per pip untuk 0.01 lot, 0.10 lot, dan 1.00 lot pada instrumen yang Anda perdagangkan.",
              "Gunakan rumus Used Margin = (Ukuran Lot × Contract Size × Harga Pembukaan) / Leverage untuk memverifikasi ketahanan Free Margin Anda.",
              "Tetapkan aturan pribadi bahwa total Used Margin dari seluruh posisi terbuka tidak boleh melampaui 10% dari total Equity akun.",
            ],
            commonMistakes: [
              "Menentukan ukuran lot berdasarkan seberapa besar Free Margin yang masih bisa dibuka, bukan berdasarkan batas risiko nominal Stop Loss.",
              "Mengira leverage tinggi membuat risiko per transaksi menjadi lebih kecil.",
              "Membiarkan posisi merugi tanpa Stop Loss hingga terkena likuidasi paksa (Stop Out) yang menghancurkan psikologi dan modal.",
            ],
            keyTakeaways: [
              "Margin adalah uang jaminan pembuka kontrak, bukan biaya yang dipotong permanen.",
              "Stop Out terjadi secara otomatis ketika Margin Level (%) turun menyentuh batas likuidasi broker.",
              "Profesional menggunakan leverage semata-mata untuk efisiensi margin sambil menjaga risiko per transaksi tetap 0.5%–1% dari modal.",
            ],
            quiz: [
              {
                id: "q1-2-inline-1",
                question: "Jika dua akun memiliki modal yang sama ($5,000) dan sama-sama membuka 0.10 lot XAUUSD dengan Stop Loss 30 pips, apa perbedaan antara akun dengan leverage 1:100 dan akun dengan leverage 1:500?",
                options: [
                  "Akun leverage 1:500 akan mengalami kerugian dollar 5 kali lebih besar jika Stop Loss tersentuh",
                  "Nilai risiko dollar jika Stop Loss tersentuh sama persis, namun akun 1:500 menahan Used Margin yang lebih kecil",
                  "Akun leverage 1:100 tidak akan pernah terkena Stop Loss",
                  "Akun leverage 1:500 otomatis menggandakan jarak Take Profit",
                ],
                correctAnswer: 1,
                explanation:
                  "Ukuran lot (0.10 lot) dan jarak Stop Loss (30 pips) menentukan besarnya kerugian dollar. Leverage hanya menentukan besaran Used Margin yang ditahan sebagai jaminan.",
              },
            ],
          },
          {
            id: "l1-3",
            slug: "kuis-fondasi-pasar",
            title: "Kuis Evaluasi Modul 1: Mikrostruktur Pasar & Risiko Leverage",
            duration: "12 Menit",
            type: "quiz",
            summary: "Evaluasi wajib Modul 1 untuk menguji penguasaan mekanisme likuiditas buku order, perhitungan margin, dan manajemen leverage.",
            learningObjectives: [
              "Menguji pemahaman mekanisme lelang order book dan pergerakan harga",
              "Menguji ketepatan prinsip penggunaan leverage dan perlindungan modal",
              "Mengidentifikasi kondisi pasar dengan risiko likuiditas tertinggi",
            ],
            content: [
              "Pada evaluasi akhir Modul 1 ini, Anda akan diuji mengenai mekanisme dasar pergerakan harga di buku order, fungsi leverage yang sehat, serta identifikasi risiko likuiditas saat berita makroekonomi dirilis.",
              "Pastikan Anda membaca setiap skenario dengan cermat. Batas nilai kelulusan evaluasi adalah minimal 70%.",
            ],
            applicationExample:
              "Sebelum beralih ke analisis sesi perdagangan global, seorang analis harus mampu membedakan risiko eksekusi akibat pelebaran spread dari risiko arah pasar.",
            caseStudy:
              "Evaluasi ini merangkum skenario nyata yang dihadapi trader saat terjadi lonjakan volatilitas dan penggunaan leverage di akun perdagangan.",
            practicalSteps: [
              "Pilih jawaban yang paling tepat untuk ketiga pertanyaan evaluasi di bawah ini.",
              "Kirim jawaban ke server untuk melihat skor kelulusan dan pembahasan lengkap setiap nomor.",
            ],
            commonMistakes: [
              "Menjawab berdasarkan asumsi indikator teknikal semata tanpa meninjau mekanisme order book.",
            ],
            keyTakeaways: [
              "Kelulusan evaluasi Modul 1 (skor ≥ 70%) membuktikan kesiapan Anda memahami struktur waktu perdagangan global di Modul 2.",
              "Mekanisme buku order, pengendalian leverage 1–2%, dan kewaspadaan berita High Impact adalah fondasi utama keamanan modal.",
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
                explanation:
                  "Harga bergerak karena ketidakseimbangan order lelang (Market Order agresif yang menghabisi antrean Limit Order pasif). Indikator hanya mencerminkan apa yang sudah terjadi pada pergerakan harga tersebut.",
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
                explanation:
                  "Profesional mengontrol risiko nominal dalam dollar (1-2% modal) melalui position sizing dan Stop Loss, sehingga fasilitas leverage tinggi hanya dipakai untuk efisiensi Used Margin.",
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
                explanation:
                  "Saat rilis berita berdampak besar, likuiditas pasif sering ditarik sementara dari buku order, menyebabkan spread melebar ekstrem dan order dieksekusi dengan slippage besar.",
              },
            ],
          },
        ],
      },
      {
        id: "m1-2",
        title: "Modul 2: Siklus Sesi Perdagangan Global & Protokol Eksekusi",
        description: "Memetakan jam likuiditas institusional (Asia, London, New York) dan menyusun protokol kesiapan eksekusi harian.",
        lessons: [
          {
            id: "l1-4",
            slug: "sesi-perdagangan-global",
            title: "Karakteristik 3 Sesi Utama: Asia, London, dan New York",
            duration: "20 Menit",
            type: "reading",
            summary: "Memahami anatomi likuiditas 24 jam: fase akumulasi Sesi Asia, ekspansi Sesi London, dan puncak volume pada Overlap London–New York.",
            learningObjectives: [
              "Memetakan rentang waktu aktif Sesi Asia, London, dan New York dalam Waktu Indonesia Barat (WIB)",
              "Menjelaskan dinamika Akumulasi–Manipulasi–Distribusi lintas sesi perdagangan harian",
              "Menentukan jendela waktu eksekusi terbaik sesuai pasangan instrumen yang diperdagangkan",
            ],
            content: [
              "Meskipun pasar valuta asing dan komoditas beroperasi 24 jam sehari dari Senin pagi hingga Sabtu dini hari WIB, volume transaksi dan volatilitas tidak terdistribusi secara merata. Aktivitas pasar mengikuti perputaran matahari melintasi tiga pusat keuangan dunia: Tokyo/Singapura (Sesi Asia), London/Frankfurt (Sesi Eropa), dan New York (Sesi Amerika Utara).",
              "Sesi Asia (sekitar pukul 06:00 – 14:00 WIB) umumnya memiliki volume transaksi yang lebih moderat untuk instrumen berbasis Eropa dan AS. Pada fase ini, harga emas (XAUUSD) maupun pasangan seperti EURUSD dan GBPUSD sering bergerak dalam rentang konsolidasi (Asian Range). Batas titik tertinggi (Asian High) dan titik terendah (Asian Low) dari sesi ini menjadi patokan penting karena di sanalah order Stop Loss trader sesi pagi terkumpul.",
              "Sesi London (sekitar pukul 14:00 – 23:00 WIB) merupakan pusat kliring valuta asing terbesar di dunia yang menyumbang lebih dari 35% volume transaksi global. Pada jam pertama pembukaan London (14:00 – 16:00 WIB), lonjakan volume institusional sering kali menyapu likuiditas di atas Asian High atau di bawah Asian Low (dikenal sebagai false break awal sesi) sebelum membentuk tren arah harian yang sesungguhnya.",
              "Jendela waktu paling likuid dan bertenaga terjadi pada periode Overlapping Sesi London dan New York (pukul 19:00 – 23:00 WIB). Pada jam ini, perbankan Eropa dan institusi Wall Street bertransaksi secara bersamaan, bertepatan pula dengan rilis data ekonomi utama Amerika Serikat (pukul 19:30 atau 21:00 WIB). Setelah pasar London tutup pada pukul 23:00 WIB, volatilitas berangsur melandai menuju penutupan sesi New York (03:00 – 04:00 WIB) di mana spread kembali melebar saat pergantian hari server (rollover).",
            ],
            applicationExample:
              "Seorang trader XAUUSD menandai batas Asian High di 2658.00 dan Asian Low di 2649.00 pada pukul 13:30 WIB. Saat pembukaan London pukul 14:15 WIB, harga menyapu tipis 2648.20, menolak turun lebih lanjut, lalu berbalik menembus struktur naik. Trader memanfaatkan konfirmasi ini untuk mengikuti ekspansi tren menuju sesi New York.",
            caseStudy:
              "Audit terhadap 100 transaksi seorang siswa menunjukkan bahwa 70% kerugian beruntunnya terjadi karena memaksakan strategi breakout pada pukul 10:00 WIB (tengah sesi Asia) saat volume XAUUSD sedang sepi. Ketika jam eksekusinya dibatasi hanya pada pukul 14:30 – 22:30 WIB, frekuensi sinyal palsu turun signifikan karena eksekusi didukung oleh volume institusional.",
            practicalSteps: [
              "Tandai kotak rentang waktu Sesi Asia (06:00–13:30 WIB) pada chart M15 Anda dan amati bagaimana harga bereaksi terhadap batas High/Low tersebut saat memasuki pukul 14:00 WIB.",
              "Tetapkan maksimal 2 jendela waktu kerja pribadi (misalnya pukul 14:30–17:00 WIB atau 19:30–22:30 WIB) agar Anda tidak kelelahan memantau layar seharian.",
              "Hindari membuka posisi baru antara pukul 03:30 – 05:30 WIB karena pelebaran spread rollover.",
            ],
            commonMistakes: [
              "Menggunakan strategi breakout di tengah sesi Asia yang cenderung bergerak menyamping (mean-reverting).",
              "Membuka posisi tepat 1 menit sebelum rilis data AS pukul 19:30 WIB tanpa menunggu respons awal pasar.",
              "Memantau grafik selama 16 jam nonstop hingga mengalami kelelahan kognitif dan membuat keputusan impulsif di akhir sesi New York.",
            ],
            keyTakeaways: [
              "Pilih waktu trading di mana instrumen Anda memiliki likuiditas paling dalam dan spread paling rapat.",
              "Overlap London–New York (19:00–23:00 WIB) menghadirkan volume dan pergerakan paling terarah.",
              "Batas High dan Low Sesi Asia sering menjadi kolam likuiditas (liquidity pool) yang diuji saat pembukaan Sesi London.",
            ],
            quiz: [
              {
                id: "q1-4-inline-1",
                question: "Mengapa batas titik tertinggi dan terendah Sesi Asia (Asian High & Asian Low) sangat penting diperhatikan saat memasuki pembukaan Sesi London?",
                options: [
                  "Karena harga tidak pernah diizinkan melewati batas Sesi Asia oleh bursa",
                  "Karena area di luar Asian High/Low menyimpan kumpulan order Stop Loss dan Breakout yang sering menjadi target likuiditas awal institusi di Sesi London",
                  "Karena spread selalu bernilai nol pada Sesi Asia",
                  "Karena Sesi London memiliki volume yang lebih kecil dibanding Sesi Asia",
                ],
                correctAnswer: 1,
                explanation:
                  "Konsolidasi selama Sesi Asia membuat banyak trader menempatkan Stop Loss tepat di atas Asian High dan di bawah Asian Low, menjadikannya area likuiditas utama saat volume besar London masuk.",
              },
            ],
          },
          {
            id: "l1-5",
            slug: "video-mekanisme-likuiditas-pasar",
            title: "Video Panduan & Studi Kasus: Visualisasi Order Flow & Eksekusi Sesi",
            duration: "18 Menit",
            type: "video",
            summary: "Observasi terstruktur bagaimana order institusional menyerap likuiditas pasif dan bagaimana menyusun SOP pra-eksekusi harian.",
            learningObjectives: [
              "Mengamati interaksi antara likuiditas pasif (resting orders) dan eksekusi agresif pada grafik harga",
              "Menyusun daftar periksa (pre-trade checklist) sebelum melakukan eksekusi order",
              "Mengevaluasi kesiapan teknis: jenis order (Market vs Limit vs Stop), batas risiko, dan jadwal berita",
            ],
            content: [
              "Dalam materi video dan panduan praktik ini, kita memadukan seluruh konsep fundamental yang telah dipelajari: mulai dari cara membaca kepadatan buku order, memilih jenis instruksi order yang tepat, hingga menyelaraskan waktu eksekusi dengan ritme sesi perdagangan global.",
              "Dalam praktik nyata, trader profesional jarang mengejar harga yang sedang berlari kencang dengan Market Order. Sebaliknya, mereka menempatkan Limit Order pada zona harga yang memiliki nilai probabilitas terukur atau menunggu konfirmasi penutupan candle setelah likuiditas tersapu.",
              "Perhatikan pula tiga komponen wajib sebelum menekan tombol transaksi: (1) Apakah ada rilis berita High Impact dalam 15 menit ke depan pada kalender ekonomi? (2) Di mana titik pembatalan skenario (Stop Loss) secara struktural? (3) Berapa ukuran lot yang tepat agar jika Stop Loss tersentuh, kerugian tidak melebihi batas risiko harian?",
            ],
            videoUrl: "https://www.youtube.com/embed/b13a7c6oG1s",
            videoDuration: "16:24",
            applicationExample:
              "Sebelum memulai sesi pukul 14:00 WIB, seorang trader membuka kalender ekonomi, mencatat rilis CPI AS pukul 19:30 WIB, memeriksa bahwa spread XAUUSD normal di 18 poin, dan menetapkan bahwa seluruh posisi intraday harus sudah diamankan minimal 15 menit sebelum rilis CPI.",
            caseStudy:
              "Perbandingan hasil eksekusi selama 30 hari menunjukkan bahwa penggunaan Limit Order pada area retest menghemat rata-rata 1.5 hingga 3 pips biaya slippage per transaksi dibandingkan mengejar candle impulsif menggunakan Market Order.",
            practicalSteps: [
              "Simak video visualisasi aliran order dan perhatikan perbedaan kecepatan gerak harga saat memasuki pembukaan sesi.",
              "Buat catatan tertulis berisi 4 poin pemeriksaan pra-pasar: Kalender Ekonomi, Sesi Aktif, Lebar Spread, dan Batas Risiko Maksimal per Transaksi.",
              "Uji coba penempatan Buy Limit, Sell Limit, Stop Loss, dan Take Profit pada akun simulasi untuk memastikan tidak ada kesalahan input volume lot.",
            ],
            commonMistakes: [
              "Salah membedakan fungsi Buy Limit (order beli di bawah harga berjalan) dan Buy Stop (order beli di atas harga berjalan).",
              "Lupa memeriksa jadwal rilis berita FOMC atau NFP sehingga posisi terbuka terkena lonjakan volatilitas dua arah (whipsaw).",
            ],
            keyTakeaways: [
              "Order book merepresentasikan antrean likuiditas pasif, sementara Market Order adalah pemicu pergeseran harga.",
              "Disiplin memeriksa kalender ekonomi dan spread sebelum entry adalah bagian tak terpisahkan dari manajemen risiko.",
              "Persiapan pra-sesi yang terstruktur mencegah keputusan impulsif saat harga bergerak cepat.",
            ],
            quiz: [
              {
                id: "q1-5-inline-1",
                question: "Jenis pending order apa yang digunakan apabila harga XAUUSD saat ini berada di 2660.00 dan Anda ingin membeli secara otomatis hanya jika harga turun terlebih dahulu ke zona diskon 2652.00?",
                options: [
                  "Buy Stop di 2652.00",
                  "Buy Limit di 2652.00",
                  "Sell Limit di 2652.00",
                  "Market Buy langsung di 2660.00",
                ],
                correctAnswer: 1,
                explanation:
                  "Buy Limit digunakan untuk memasang antrean beli pada harga yang lebih rendah (lebih murah) daripada harga pasar saat ini.",
              },
            ],
          },
          {
            id: "l1-6",
            slug: "kuis-evaluasi-akhir-fundamentals",
            title: "Final Assessment: Kuis Akhir Kelulusan Trading Fundamentals",
            duration: "15 Menit",
            type: "quiz",
            summary: "Ujian komprehensif penentu kelulusan kelas SC-01 Trading Fundamentals (Batas kelulusan: 70%).",
            learningObjectives: [
              "Menguji penguasaan menyeluruh atas siklus sesi perdagangan, manajemen risiko dasar, dan fungsi Stop Loss",
              "Memverifikasi kesiapan akademik siswa sebelum naik ke kelas analisis teknikal Candlestick & Price Action",
            ],
            content: [
              "Selamat datang di Final Assessment kelas SC-01: Trading Fundamentals. Evaluasi akhir ini menguji pemahaman terpadu Anda mengenai jam likuiditas pasar global, perhitungan batas risiko nominal per transaksi, dan fungsi proteksi modal menggunakan Stop Loss.",
              "Jawablah seluruh pertanyaan dengan teliti. Anda memerlukan skor minimal 70% untuk menuntaskan kelas ini dan membuka hak klaim Sertifikat Kelulusan.",
            ],
            applicationExample:
              "Mengintegrasikan pemilihan sesi perdagangan terbaik (Overlap London–New York) dengan batasan risiko 1% per transaksi dan penempatan Stop Loss yang disiplin.",
            caseStudy:
              "Seorang trader dengan modal $10,000 menetapkan risiko maksimal 1% ($100) per transaksi dan hanya mengeksekusi rencana tradingnya pada jam likuiditas optimal dengan proteksi Stop Loss terukur.",
            practicalSteps: [
              "Tinjau kembali rumus perhitungan risiko 1% dari modal akun.",
              "Kerjakan seluruh soal evaluasi akhir dan pelajari umpan balik penjelasan dari server.",
            ],
            commonMistakes: [
              "Menghitung persentase risiko dari ukuran lot, bukan dari saldo modal akun (Balance/Equity).",
            ],
            keyTakeaways: [
              "Ketahanan modal melalui pembatasan risiko 1% per transaksi dan penggunaan Stop Loss wajib menjadi kebiasaan permanen setiap trader.",
              "Pemilihan jam likuiditas optimal (Overlap London–New York) menyelaraskan eksekusi Anda dengan volume institusional.",
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
                explanation:
                  "Overlap London dan New York mempertemukan dua pusat keuangan terbesar di dunia sehingga volume dan volatilitas mencapai puncak tertingginya.",
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
                explanation:
                  "1% dari $10,000 adalah $100. Stop loss harus dihitung sedemikian rupa sehingga jika tersentuh, kerugian tidak lebih dari $100.",
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
                explanation:
                  "Stop loss adalah sabuk pengaman trading yang mengeksekusi cut-loss otomatis ketika skenario analisis kita tidak valid.",
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
    subtitle: "Membaca Narasi Psikologis Pembeli vs Penjual dari Anatomi OHLC, Sumbu, dan Struktur Multi-Candle",
    category: "Technical Analysis",
    level: "Beginner",
    duration: "4 Jam",
    totalLessons: 6,
    featured: true,
    instructor: {
      name: "Casper Market Research",
      role: "Lead Trading Analyst",
    },
    overview:
      "Menghafal puluhan nama pola candlestick tanpa memahami mekanisme order di baliknya adalah jebakan klasik analisis teknikal. Kelas ini mengajarkan Anda membaca candlestick sebagai rekam jejak pertarungan likuiditas: bagaimana membedah anatomi Open-High-Low-Close (OHLC), mengukur rasio momentum tubuh (body) terhadap sumbu penolakan (rejection wick), membedakan liquidity sweep dari breakout sejati, serta menggabungkan struktur multi-candle dalam konteks lokasi pasar.",
    objectives: [
      "Membongkar anatomi candlestick OHLC serta rasio ukuran Body vs Wick sebagai indikator momentum dan penolakan harga",
      "Mengidentifikasi anatomi Rejection Pinbar dan membedakannya dari False Breakout (Liquidity Sweep) di area kunci",
      "Menganalisis struktur multi-candle: Impulsive Engulfing, Inside Bar (kompresi volatilitas), dan Momentum Exhaustion",
      "Menerapkan aturan Location + Context sehingga tidak pernah mengeksekusi pola candlestick di tengah area acak (no-man's land)",
    ],
    competencies: [
      "Mampu menerjemahkan bentuk candle pada timeframe berapa pun menjadi narasi siapa yang sedang memegang kendali (pembeli atau penjual)",
      "Mampu memfilter sinyal candlestick palsu dengan memverifikasi lokasi penutupan body candle terhadap level likuiditas",
      "Mampu mengonversi rangkaian candlestick timeframe rendah menjadi satu candlestick gabungan di timeframe tinggi (Candle Blending)",
    ],
    prerequisites: [
      "Telah menyelesaikan kelas SC-01: Trading Fundamentals",
      "Memahami konsep dasar Bid, Ask, Limit Order, dan Market Order",
    ],
    courseSummary: [
      "Setiap candlestick merangkum 4 titik data harga (Open, High, Low, Close) yang menceritakan hasil akhir pertarungan order dalam satu periode waktu.",
      "Body tebal dengan sumbu tipis menandakan dominasi impulsif satu pihak, sedangkan sumbu panjang (≥ 2x body) menandakan penolakan harga (rejection) dan penyerapan order lawan.",
      "Pola candlestick tunggal maupun multi-candle (Pinbar, Engulfing, Inside Bar) hanya memiliki nilai probabilitas tinggi apabila terbentuk di zona reaksi kunci, bukan di tengah rentang konsolidasi acak.",
      "Penutupan body candle (Candle Close) adalah validasi utama apakah sebuah level benar-benar ditembus (Breakout) atau hanya disapu sumbunya (Liquidity Sweep).",
    ],
    references: [
      "Nison, S. (2001). Japanese Candlestick Charting Techniques (2nd ed.). New York Institute of Finance.",
      "Brooks, A. (2012). Trading Price Action Trends: Technical Analysis of Price Charts Bar by Bar for the Serious Trader. Wiley.",
      "Volman, B. (2011). Understanding Price Action: Practical Analysis of the 5-Minute Time Frame. Light Tower Publishing.",
    ],
    modules: [
      {
        id: "m2-1",
        title: "Modul 1: Anatomi OHLC, Momentum Body, dan Sumbu Penolakan",
        description: "Menafsirkan dominasi pembeli vs penjual melalui proporsi body, panjang sumbu, dan jejak sapuan likuiditas.",
        lessons: [
          {
            id: "l2-1",
            slug: "anatomi-ohlc-dan-cerita-dibaliknya",
            title: "Membongkar OHLC: Siapa yang Memegang Kendali?",
            duration: "20 Menit",
            type: "reading",
            summary: "Candlestick bukan sekadar kotak hijau atau merah, melainkan visualisasi langsung dari perpindahan kendali order antara pembeli dan penjual.",
            learningObjectives: [
              "Mengidentifikasi keempat komponen harga OHLC (Open, High, Low, Close) pada candle Bullish dan Bearish",
              "Menganalisis hubungan antara ukuran Real Body dan kekuatan momentum arah pasar",
              "Menjelaskan makna psikologis Upper Wick dan Lower Wick sebagai jejak penolakan harga (price rejection)",
            ],
            visualDiagram: "candlestick-anatomy",
            content: [
              "Setiap batang candlestick Jepang merangkum empat informasi krusial dalam satu rentang waktu spesifik: harga pembukaan (Open), titik tertinggi yang sempat disentuh (High), titik terendah yang sempat dicapai (Low), dan harga penutupan akhir periode (Close). Apabila harga Close berada di atas harga Open, terbentuk candle Bullish (pembeli memenangkan periode tersebut). Apabila harga Close berada di bawah harga Open, terbentuk candle Bearish (penjual memenangkan periode tersebut).",
              "Bagian kotak tebal di antara Open dan Close disebut Real Body. Panjang Real Body mencerminkan seberapa tegas komitmen dan momentum pihak pemenang. Sebuah candle Bullish Marubozu—yang memiliki body panjang penuh dan hampir tanpa sumbu atas/bawah—menunjukkan bahwa sejak menit pembukaan hingga detik penutupan, pembeli agresif terus menyerap penawaran tanpa memberi kesempatan penjual menekan harga turun.",
              "Sebaliknya, garis vertikal tipis di atas dan di bawah body disebut Sumbu atau Bayangan (Wick / Shadow). Sumbu adalah rekam jejak penolakan harga (rejection). Sumbu atas (Upper Wick) yang sangat panjang menunjukkan bahwa pembeli sempat mendorong harga naik jauh, tetapi di area puncak tersebut mereka dihadang oleh tembok Limit Sell dan serangan Market Sell yang begitu besar hingga harga dipaksa mundur kembali mendekati titik pembukaan.",
              "Kunci membaca candlestick secara profesional adalah mengevaluasi dua rasio: (1) Rasio ukuran Body terhadap total rentang High–Low candle tersebut, dan (2) Posisi penutupan (Close) relatif terhadap rentang keseluruhannya. Candle yang ditutup di 10% teratas dari rentang High–Low memiliki bias tekanan beli yang jauh lebih kuat dibandingkan candle yang ditutup di tengah-tengah rentang dengan sumbu sama panjang di kedua sisi (Doji / Spinning Top).",
            ],
            applicationExample:
              "Pada timeframe H1 XAUUSD, harga dibuka di 2650.00, sempat turun ke 2642.00, namun kemudian diserap oleh pembeli institusional dan ditutup di 2653.00 (High di 2654.00). Meskipun body-nya hanya 30 pips (2650 ke 2653), sumbu bawah sepanjang 80 pips (2642 ke 2650) membuktikan adanya penolakan jual yang sangat agresif di bawah 2650.00.",
            caseStudy:
              "Saat harga mendekati area Resistance H4 di 2680.00, tiga candle H1 berturut-turut menunjukkan ukuran body yang semakin mengecil (dari 45 pips menjadi 20 pips lalu 8 pips) disertai sumbu atas yang semakin memanjang. Ini adalah tanda klasik hilangnya momentum beli (momentum exhaustion) sebelum penjual mengambil alih kendali.",
            practicalSteps: [
              "Buka grafik H1 atau H4 pada instrumen pilihan Anda dan amati 10 candlestick terakhir satu per satu tanpa menggunakan indikator apa pun.",
              "Untuk setiap candle, ukur secara visual: di mana posisi Close relatif terhadap rentang High–Low, dan pihak mana yang menguasai penutupan periode tersebut.",
              "Tandai candle yang memiliki sumbu minimal 2 kali lebih panjang dari ukuran body-nya dan amati reaksi candle berikutnya.",
            ],
            commonMistakes: [
              "Hanya melihat warna candle (hijau/merah) tanpa memperhatikan sumbu penolakan yang panjang.",
              "Mengambil keputusan entry sebelum periode waktu candlestick benar-benar selesai ditutup (candle belum close).",
              "Mengabaikan ukuran candle relatif terhadap rata-rata 10–20 candle sebelumnya.",
            ],
            keyTakeaways: [
              "Body tebal yang ditutup dekat ekstrem High/Low menunjukkan momentum kuat dan komitmen arah.",
              "Wick panjang menunjukkan area harga yang ditolak keras oleh lawan transaksi.",
              "Penyusutan ukuran body secara beruntun di dekat level kunci menandakan kelelahan momentum (exhaustion).",
            ],
            quiz: [
              {
                id: "q2-1-inline-1",
                question: "Apa arti mikrostruktur dari sebuah candle H1 yang dibuka di 2650, sempat turun ke 2640, lalu ditutup di 2652 dengan titik tertinggi di 2652.5?",
                options: [
                  "Penjual memegang kendali penuh pada akhir jam tersebut",
                  "Terjadi penolakan jual yang kuat di area 2640–2650 di mana pembeli menyerap seluruh tekanan jual dan menutup periode di dekat titik tertinggi",
                  "Pasar berada dalam kondisi tanpa likuiditas",
                  "Harga pasti akan turun kembali ke 2640 pada menit berikutnya",
                ],
                correctAnswer: 1,
                explanation:
                  "Sumbu bawah sepanjang $10 (2640 ke 2650) diikuti penutupan bullish di 2652 menunjukkan bahwa tekanan jual ke 2640 telah diserap habis oleh pembeli yang berhasil mendorong harga balik ke atas harga pembukaan.",
              },
            ],
          },
          {
            id: "l2-2",
            slug: "studi-chart-pinbar-dan-engulfing",
            title: "Studi Kasus Visual: Rejection Pinbar vs False Breakout (Liquidity Sweep)",
            duration: "22 Menit",
            type: "chart-study",
            summary: "Analisis visual bagaimana sumbu candle menyapu kumpulan Stop Loss di balik level kunci sebelum harga berbalik arah dengan cepat.",
            learningObjectives: [
              "Mendefinisikan kriteria teknis Rejection Pinbar yang valid (proporsi sumbu, ukuran body, dan posisi penutupan)",
              "Membedakan antara Breakout struktural yang sah dan False Breakout (Liquidity Sweep / Stop Hunt)",
              "Menempatkan titik invalidasi (Stop Loss) yang logis berdasarkan anatomi candle penolakan",
            ],
            content: [
              "Pinbar (Pinocchio Bar) atau Hammer/Shooting Star adalah candlestick dengan sumbu satu sisi yang sangat panjang (umumnya mencakup 65%–80% dari total panjang candle) dan body kecil yang terkonsentrasi di salah satu ujungnya. Namun, tidak semua candle bersumbu panjang layak ditransaksikan. Pinbar yang muncul di tengah area konsolidasi sempit hanyalah fluktuasi acak (noise).",
              "Sebuah Rejection Pinbar berkualitas tinggi lahir dari mekanisme Liquidity Sweep (sapuan likuiditas). Bayangkan sebuah level Support H4 yang jelas di 2650.00. Ribuan trader retail yang membeli di atas 2650.00 menempatkan Stop Loss (yang berupa order Sell Stop) tepat di 2648.00–2649.00. Di saat yang sama, trader breakout memasang pending order Sell Stop di level yang sama.",
              "Ketika harga turun menembus 2650.00 menuju 2644.00, seluruh order Sell Stop tersebut terpicu menjadi Market Sell. Institusi besar memanfaatkan banjir Market Sell murah tersebut untuk mengisi antrean Limit Buy mereka dalam jumlah besar tanpa membuat harga melonjak prematur. Begitu seluruh order jual retail terserap habis, harga berbalik naik dengan cepat dan menutup periode H4 kembali di atas 2650.00—meninggalkan sumbu bawah sepanjang 60 pips.",
              "Fenomena inilah yang disebut False Breakout atau Bullish Liquidity Sweep. Penutupan body candle yang kembali berada di dalam batas level Support membuktikan bahwa penembusan ke bawah hanyalah sapuan likuiditas, bukan kelanjutan tren turun.",
            ],
            applicationExample:
              "Pada grafik XAUUSD H4, level Support berada di 2650.00. Candle H4 sempat menembus turun ke 2644.00, namun pada penutupan jam ke-4, candle ditutup pada 2652.50. Trader tidak panik melakukan Sell saat candle masih bergerak di 2645.00, melainkan menunggu penutupan candle H4 untuk memvalidasi bahwa penembusan tersebut adalah False Breakout.",
            caseStudy:
              "Studi kasus XAUUSD H4 di Support 2650.00: trader yang terburu-buru melakukan entry Sell saat harga baru menyentuh 2647.00 (sebelum candle H4 tutup) terjebak di titik terendah (selling the bottom) ketika candle menutup kembali di 2652.50 dan melanjutkan reli sejauh 180 pips.",
            chartData: {
              title: "XAUUSD H4 Rejection Pinbar & Liquidity Sweep di Support 2650.00",
              description: "Harga menyapu order Sell Stop di bawah level 2650.00 hingga 2644.00, menyerap likuiditas jual, dan ditutup kembali di atas 2650.00 dengan wick bawah 60 pips sebelum ekspansi 180 pips.",
              timeframe: "H4",
              bias: "Bullish",
            },
            practicalSteps: [
              "Tandai level Support dan Resistance paling jelas pada timeframe H4 atau D1.",
              "Saat harga menembus level tersebut, disiplinlah menunggu hingga candle H1/H4 benar-benar ditutup (close) sebelum menyimpulkan apakah terjadi Breakout atau False Breakout.",
              "Jika candle ditutup kembali di dalam level dengan sumbu penolakan panjang, letakkan titik invalidasi (Stop Loss) beberapa pips di luar ujung ekstrem sumbu tersebut.",
            ],
            commonMistakes: [
              "Mengeksekusi posisi Breakout sebelum candlestick selesai ditutup sehingga terjebak dalam False Breakout.",
              "Menempatkan Stop Loss terlalu rapat di tengah-tengah sumbu Pinbar, bukan di luar ujung ekstrem sumbunya.",
              "Menganggap setiap Pinbar di timeframe M1/M5 sebagai pembalikan tren utama tanpa melihat level H4.",
            ],
            keyTakeaways: [
              "Tunggu penutupan candle (Candle Close) untuk membedakan Breakout sejati dari Liquidity Sweep.",
              "Pinbar bernilai probabilitas tinggi hanya jika menyapu likuiditas di level kunci dan ditutup kembali ke arah berlawanan.",
              "Ujung ekstrem sumbu penolakan adalah batas invalidasi alami dari skenario price action tersebut.",
            ],
            quiz: [
              {
                id: "q2-2-inline-1",
                question: "Apa perbedaan utama antara Breakout bearish yang valid dan False Breakout (Liquidity Sweep) pada level Support 2650.00?",
                options: [
                  "Breakout valid ditutup tegas dengan body candle di bawah 2650.00, sedangkan False Breakout hanya menembus dengan sumbu (wick) lalu ditutup kembali di atas 2650.00",
                  "Breakout valid selalu terjadi pada hari Senin pagi",
                  "False Breakout tidak pernah menyentuh level 2650.00 sama sekali",
                  "Tidak ada perbedaan, keduanya merupakan sinyal jual",
                ],
                correctAnswer: 0,
                explanation:
                  "Validasi penembusan level ditentukan oleh penutupan body candle (Candle Close). Jika hanya sumbu yang menembus lalu body kembali ditutup di atas Support, itu adalah indikasi Liquidity Sweep / False Breakout.",
              },
            ],
          },
          {
            id: "l2-3",
            slug: "kuis-candlestick-action",
            title: "Kuis Evaluasi Modul 1: Membaca Sumbu dan Momentum Candle",
            duration: "12 Menit",
            type: "quiz",
            summary: "Evaluasi wajib Modul 1 untuk menguji ketajaman membaca psikologi OHLC, sumbu penolakan, dan validasi penutupan candle.",
            learningObjectives: [
              "Menguji interpretasi narasi psikologis di balik rasio body dan wick candlestick",
              "Menguji pemahaman tentang pentingnya menunggu penutupan candle (Candle Close)",
              "Mengevaluasi identifikasi Liquidity Sweep pada level harga kunci",
            ],
            content: [
              "Jawablah rangkaian pertanyaan evaluasi Modul 1 berikut untuk menguji pemahaman Anda mengenai anatomi OHLC, interpretasi sumbu penolakan (wick rejection), serta perbedaan antara penembusan valid dan sapuan likuiditas.",
              "Batas kelulusan evaluasi ini adalah minimal 70%.",
            ],
            applicationExample:
              "Menggunakan hasil pembacaan penutupan candle H1/H4 untuk menyaring sinyal palsu sebelum masuk ke pasar.",
            caseStudy:
              "Evaluasi berbagai bentuk penutupan candlestick pada zona Resistance dan Support.",
            practicalSteps: [
              "Analisis setiap skenario candlestick pada soal berikut.",
              "Kirim jawaban Anda untuk memverifikasi skor di server.",
            ],
            commonMistakes: [
              "Menyimpulkan arah pasar hanya dari pergerakan candle yang masih berjalan (belum close).",
            ],
            keyTakeaways: [
              "Panjang sumbu dan posisi penutupan body adalah inti dari analisis candlestick murni.",
              "Disiplin menunggu Candle Close menghindarkan Anda dari jebakan sapuan likuiditas (False Breakout).",
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
                explanation:
                  "Wick atas yang panjang menunjukkan harga sempat naik tinggi tetapi ditolak keras oleh penjual sebelum periode ditutup.",
              },
              {
                id: "q2-1-2",
                question: "Mengapa seorang trader price action wajib menunggu candlestick selesai ditutup (candle close) sebelum mengambil kesimpulan atas suatu level?",
                options: [
                  "Karena broker melarang pembukaan order saat candle sedang berjalan",
                  "Karena candle yang tampak impulsif di pertengahan jam dapat ditolak kembali dan berakhir hanya sebagai sumbu (wick) pada detik penutupan",
                  "Agar biaya komisi transaksi menjadi gratis",
                  "Karena harga pembukaan candle baru selalu melompat 100 pips",
                ],
                correctAnswer: 1,
                explanation:
                  "Sebelum periode waktu berakhir, bentuk candle belum final. Candle yang semula tampak menembus level dengan body tebal bisa berbalik arah dan menyisakan sumbu penolakan (False Breakout) saat ditutup.",
              },
              {
                id: "q2-1-3",
                question: "Di manakah lokasi pembentukan Bullish Pinbar yang memiliki nilai probabilitas paling tinggi?",
                options: [
                  "Tepat di bawah area Resistance H4 yang kuat setelah reli panjang",
                  "Di tengah-tengah rentang konsolidasi sempit sesi Asia",
                  "Pada zona Support kunci / Demand setelah sumbu bawahnya menyapu likuiditas Stop Loss di bawah level tersebut",
                  "Pada grafik 1-detik saat pasar akan tutup",
                ],
                correctAnswer: 2,
                explanation:
                  "Bullish Pinbar memiliki probabilitas terbaik ketika terbentuk di zona Support/Demand kunci dan disertai sapuan likuiditas (liquidity sweep) terhadap order jual sebelum ditutup kembali menguat.",
              },
            ],
          },
        ],
      },
      {
        id: "m2-2",
        title: "Modul 2: Struktur Multi-Candle, Candle Blending & Konteks Lokasi",
        description: "Menguasai dinamika Engulfing, Inside Bar, penggabungan multi-candle (Candle Blending), serta filter lokasi eksekusi.",
        lessons: [
          {
            id: "l2-4",
            slug: "pola-multi-candle-engulfing-inside-bar",
            title: "Dinamika Multi-Candle: Impulsive Engulfing, Inside Bar & Candle Blending",
            duration: "22 Menit",
            type: "reading",
            summary: "Memahami bagaimana rangkaian 2–3 candlestick membentuk konfirmasi pergeseran momentum serta bagaimana menggabungkan beberapa candle menjadi satu struktur utuh.",
            learningObjectives: [
              "Menganalisis kriteria Momentum Engulfing yang mencerminkan pengambilalihan kendali pasar secara penuh",
              "Mengenali pola Inside Bar (Mother Bar & Inside Candle) sebagai fase kompresi volatilitas sebelum ekspansi",
              "Menerapkan teknik Candle Blending untuk menyetarakan struktur multi-candle LTF dengan Pinbar HTF",
            ],
            content: [
              "Jika satu candlestick menceritakan pertarungan dalam satu periode waktu, maka rangkaian dua hingga tiga candlestick memperlihatkan transisi momentum secara utuh. Dua struktur multi-candle paling fundamental dalam analisis price action institusional adalah Momentum Engulfing dan Inside Bar.",
              "Bullish Engulfing yang berkualitas tinggi bukan sekadar candle hijau yang tubuhnya sedikit lebih besar dari candle merah sebelumnya. Engulfing berprobabilitas tinggi harus bersifat impulsif: body candle kedua menutup tegas melampaui High candle sebelumnya (bukan hanya menutupi body-nya), dan idealnya mengonsumsi rentang 2 hingga 3 candle korektif sebelumnya sekaligus. Hal ini menandakan masuknya pesanan beli agresif dalam volume besar yang membalikkan keseimbangan buku order.",
              "Sementara itu, Inside Bar terjadi ketika seluruh rentang High dan Low sebuah candle (Inside Bar) berada sepenuhnya di dalam rentang High dan Low candle sebelumnya (Mother Bar). Secara mikrostruktur, Inside Bar mencerminkan keseimbangan sementara dan kompresi volatilitas (kontraksi rentang harga). Ketika batas High atau Low dari Mother Bar akhirnya ditembus dengan penutupan body yang tegas, pelepasan energi akumulasi tersebut sering memicu ekspansi searah tren utama.",
              "Lebih jauh lagi, Anda wajib memahami konsep Candle Blending (penggabungan candlestick lintas timeframe). Sebuah candle Bearish tajam pada jam pertama yang langsung diikuti oleh candle Bullish Engulfing sama besarnya pada jam kedua di timeframe H1, apabila dilihat pada timeframe H2 atau H4 sebenarnya adalah satu buah Bullish Rejection Pinbar dengan sumbu bawah panjang! Dengan memahami Candle Blending, Anda tidak lagi bingung melihat perbedaan bentuk candle antar timeframe.",
            ],
            applicationExample:
              "Pada grafik H1 EURUSD di zona Support 1.0820, candle pukul 15:00 turun tajam dari 1.0840 ke 1.0815, lalu candle pukul 16:00 langsung naik tegas dari 1.0815 dan ditutup di 1.0845 (Bullish Engulfing). Jika digabungkan (Candle Blending 2 jam), pasangan candle tersebut membentuk Pinbar Bullish dengan sumbu bawah 25 pips yang menolak area 1.0815.",
            caseStudy:
              "Dalam tren naik XAUUSD pada timeframe H4, harga berhenti sejenak membentuk Mother Bar dengan rentang 2660–2672, diikuti oleh dua Inside Bar kecil di rentang 2663–2670. Saat sesi New York dibuka, candle baru menembus dan ditutup di 2675 (di atas High Mother Bar 2672), memicu kelanjutan tren naik menuju 2690 dengan batas risiko terukur di bawah Low Inside Bar (2663).",
            practicalSteps: [
              "Pilih satu pasangan Bullish atau Bearish Engulfing pada grafik H1, lalu naikkan timeframe ke H2 atau H4 untuk melihat bagaimana kedua candle tersebut menyatu menjadi satu Pinbar.",
              "Identifikasi formasi Mother Bar dan Inside Bar pada tren yang kuat, lalu tandai batas High dan Low dari Mother Bar sebagai acuan validasi penembusan.",
              "Verifikasi bahwa candle Engulfing yang Anda tandai menutup melampaui titik ekstrem (High/Low) candle sebelumnya, bukan hanya menutup di dalam sumbunya.",
            ],
            commonMistakes: [
              "Menganggap candle kecil yang kebetulan membungkus Doji mikro di tengah pasar sepi sebagai sinyal Engulfing kuat.",
              "Membuka posisi di dalam rentang Inside Bar sebelum ada penembusan valid terhadap batas Mother Bar.",
              "Mengabaikan arah tren timeframe tinggi saat mengeksekusi pola Inside Bar.",
            ],
            keyTakeaways: [
              "Engulfing yang valid harus menunjukkan pergeseran momentum tegas dengan penutupan melampaui ekstrem candle sebelumnya.",
              "Inside Bar adalah fase kompresi energi; tunggu penembusan batas Mother Bar searah tren utama.",
              "Bullish/Bearish Engulfing terdiri dari dua candle yang jika digabungkan pada timeframe dua kali lebih besar adalah sebuah Rejection Pinbar.",
            ],
            quiz: [
              {
                id: "q2-4-inline-1",
                question: "Jika pada timeframe H1 sebuah candle Bearish penuh (14:00–15:00) langsung dibalas oleh candle Bullish Engulfing penuh dengan ukuran setara (15:00–16:00), bagaimana wujud gabungan kedua candle tersebut pada grafik H2?",
                options: [
                  "Dua buah candle Doji yang terpisah",
                  "Satu buah candle Bullish Rejection Pinbar (Hammer) dengan sumbu bawah yang panjang",
                  "Satu buah candle Bearish Marubozu tanpa sumbu",
                  "Pola tersebut hilang dan tidak tercatat di grafik H2",
                ],
                correctAnswer: 1,
                explanation:
                  "Penurunan pada jam pertama dilanjutkan kenaikan balik ke titik awal/lebih tinggi pada jam kedua menghasilkan jejak titik terendah (Low) yang jauh di bawah harga Open dan Close 2-jam, yaitu anatomi sebuah Bullish Pinbar.",
              },
            ],
          },
          {
            id: "l2-5",
            slug: "konteks-lokasi-dan-filter-price-action",
            title: "Hukum Location & Context: Mengapa Pola yang Sama Bisa Gagal",
            duration: "20 Menit",
            type: "reading",
            summary: "Membedakan sinyal price action probabilitas tinggi dari jebakan ritel dengan menggabungkan kecepatan pendekatan harga (approach velocity) dan lokasi level.",
            learningObjectives: [
              "Menjelaskan mengapa Lokasi (Where) jauh lebih penting daripada Bentuk Candle (What)",
              "Membedakan karakteristik Corrective Approach (pendekatan korektif bertahap) vs Impulsive Approach (tabrakan vertikal) menuju level kunci",
              "Menerapkan saringan 3-lapis untuk memvalidasi sinyal price action sebelum eksekusi",
            ],
            content: [
              "Satu pertanyaan paling krusial bagi setiap analis teknikal adalah: mengapa dua pola Bullish Engulfing yang bentuknya identik dapat menghasilkan reli besar pada satu kesempatan, tetapi langsung gagal menyentuh Stop Loss pada kesempatan berikutnya? Jawabannya terletak pada Hukum Lokasi dan Konteks (Location & Context).",
              "Prinsip pertama adalah Lokasi: sebuah pola candlestick hanyalah pemicu eksekusi (trigger), bukan alasan utama membuka posisi. Trigger candlestick baru bermakna apabila terbentuk tepat pada area di mana institusi memiliki kepentingan transaksi—seperti zona Support/Resistance H4/D1, area keseimbangan pasokan/permintaan, atau batas likuiditas sesi. Pola Pinbar atau Engulfing yang muncul mengambang di tengah ruang kosong (no-man's land) di antara Support dan Resistance harus diabaikan sepenuhnya.",
              "Prinsip kedua adalah Konteks Pendekatan Harga (Approach Velocity): perhatikan BAGAIMANA cara harga mendekati sebuah level kunci. Apabila harga turun mendekati zona Support melalui rangkaian candle kecil yang melambat secara bertahap (corrective / compression approach), artinya tekanan jual sudah terkuras dan kemungkinan zona Support bertahan sangat tinggi. Sebaliknya, apabila harga menghantam zona Support dengan 3 candle Bearish raksasa berturut-turut tanpa sumbu (impulsive crash), maka momentum penjual sangat dominan—membeli pada sentuhan pertama sama saja dengan menghadang kereta cepat.",
              "Oleh karena itu, gabungkan selalu tiga syarat sebelum mengeksekusi sinyal candlestick: (1) Arah tren atau struktur utama mendukung, (2) Harga sudah menyentuh zona reaksi yang telah dipetakan sebelumnya, dan (3) Kecepatan lawan mulai melambat lalu dikonfirmasi oleh penutupan candle penolakan (Pinbar / Engulfing) disertai ruang Risk-to-Reward minimal 1:2 menuju penghalang berikutnya.",
            ],
            applicationExample:
              "Harga GBPUSD sedang dalam tren naik di H4 dan terkoreksi turun secara perlahan selama 8 jam membentuk candle-candle kecil menuju zona Support 1.2950. Sesampainya di 1.2950, terbentuk Bullish Pinbar diikuti Bullish Engulfing di M30. Karena lokasi berada di Support H4, pendekatan harga bersifat korektif (lemah), dan trigger terkonfirmasi, setup ini memenuhi seluruh kriteria probabilitas tinggi.",
            caseStudy:
              "Saat pengumuman suku bunga bank sentral, harga emas terjun bebas 350 pips dalam satu candle H1 raksasa menuju Support 2620.00. Di menit terakhir terbentuk sedikit sumbu bawah. Trader yang langsung membeli tanpa menunggu konsolidasi struktur kedua terkena Stop Loss karena satu candle impulsif raksasa jarang berbalik arah secara instan tanpa fase penyerapan ulang.",
            practicalSteps: [
              "Sebelum mencari pola candlestick, gambar terlebih dahulu zona Support dan Resistance utama di timeframe tinggi.",
              "Amati 3–5 candle terakhir sebelum harga menyentuh zona tersebut: apakah ukurannya membesar secara agresif (impulsif) atau mengecil secara bertahap (korektif)?",
              "Batalkan rencana entry apabila candle konfirmasi ditutup terlalu jauh dari zona sehingga membuat jarak Stop Loss terlalu lebar dan merusak rasio Risk-to-Reward.",
            ],
            commonMistakes: [
              "Mencari pola candlestick terlebih dahulu baru kemudian memaksakan menggambar garis level agar cocok dengan posisi yang diinginkan (confirmation bias).",
              "Tetap membeli Bullish Engulfing yang ukurannya terlalu raksasa hingga menyentuh langsung area Resistance di atasnya (buying into resistance).",
              "Melawan momentum candle impulsif raksasa tanpa menunggu pembentukan struktur perlambatan.",
            ],
            keyTakeaways: [
              "Lokasi (Where) adalah raja; bentuk candlestick (What) hanyalah konfirmasi pemicu (Trigger).",
              "Pendekatan korektif yang melambat menuju level kunci memberikan probabilitas pantulan jauh lebih baik daripada pendekatan vertikal impulsif.",
              "Jangan pernah mengeksekusi candle konfirmasi yang ditutup tepat di depan penghalang (Support/Resistance) lawan.",
            ],
            quiz: [
              {
                id: "q2-5-inline-1",
                question: "Kondisi pendekatan harga (price approach) manakah yang memberikan probabilitas terbaik untuk mencari sinyal beli (Bullish Price Action) di zona Support?",
                options: [
                  "Harga jatuh vertikal dengan 4 candle Bearish Marubozu raksasa berturut-turut menghantam Support",
                  "Harga turun secara bertahap dengan ukuran body candle bearish yang semakin mengecil (kehilangan momentum jual) saat memasuki zona Support",
                  "Harga sudah menembus dan ditutup 100 pips di bawah zona Support",
                  "Harga berada di tengah-tengah antara Support dan Resistance tanpa menyentuh level mana pun",
                ],
                correctAnswer: 1,
                explanation:
                  "Penyusutan ukuran candle saat mendekati zona Support menunjukkan bahwa penjual sudah kehabisan tenaga (exhaustion), sehingga kehadiran pembeli di zona Support dapat membalikkan harga dengan lebih mudah.",
              },
            ],
          },
          {
            id: "l2-6",
            slug: "final-assessment-candlestick-price-action",
            title: "Final Assessment: Ujian Komprehensif Candlestick & Price Action",
            duration: "15 Menit",
            type: "quiz",
            summary: "Ujian akhir kelulusan kelas SC-02 Candlestick & Price Action (Batas kelulusan: 70%).",
            learningObjectives: [
              "Menguji integrasi pembacaan anatomi OHLC, Rejection Pinbar, Engulfing, Inside Bar, dan Candle Blending",
              "Memverifikasi kemampuan menyaring kualitas sinyal price action berdasarkan lokasi dan konteks pendekatan harga",
            ],
            content: [
              "Selamat datang di Final Assessment kelas SC-02: Candlestick & Price Action. Pada ujian komprehensif ini, Anda akan diuji melalui berbagai studi kasus nyata mengenai pembacaan narasi OHLC, validasi Liquidity Sweep, pola multi-candle, hingga penyaringan lokasi dan konteks.",
              "Kerjakan seluruh soal dengan saksama. Skor minimal 70% diperlukan untuk lulus dan membuka Sertifikat Kelulusan kelas SC-02.",
            ],
            applicationExample:
              "Menggabungkan pembacaan lokasi Support H4, pendekatan korektif yang melambat, dan konfirmasi Bullish Engulfing / Pinbar sebelum mengambil keputusan eksekusi.",
            caseStudy:
              "Serangkaian skenario evaluasi price action pada instrumen XAUUSD dan pasangan mata uang utama.",
            practicalSteps: [
              "Evaluasi setiap pertanyaan berdasarkan prinsip mikrostruktur order dan validasi Candle Close.",
              "Kirim jawaban Anda dan pelajari pembahasan lengkap dari setiap soal.",
            ],
            commonMistakes: [
              "Memilih sinyal hanya dari nama pola candlestick tanpa memperhitungkan lokasi dan risiko jarak Stop Loss.",
            ],
            keyTakeaways: [
              "Penguasaan Price Action yang utuh menjadi jembatan langsung untuk mempelajari kelas berikutnya: SC-03 Market Structure Mastery.",
              "Pola candlestick baru memiliki probabilitas tinggi apabila muncul pada lokasi kunci dengan pendekatan harga yang mendukung.",
            ],
            quiz: [
              {
                id: "q2-6-1",
                question: "Sebuah candle Bullish Engulfing muncul di grafik M15, namun posisinya berada tepat di bawah zona Resistance H4 yang belum tertembus. Apa tindakan paling rasional menurut prinsip Location & Context?",
                options: [
                  "Langsung membeli dengan lot maksimal karena Bullish Engulfing pasti menghasilkan kenaikan",
                  "Menahan diri untuk tidak membeli (skip setup), karena membeli tepat di bawah atap Resistance H4 menghadapkan posisi pada tembok penjual institusional dan rasio Risk-to-Reward yang buruk",
                  "Membuka posisi Buy dan Sell secara bersamaan tanpa Stop Loss",
                  "Mengganti timeframe ke M1 agar Resistance H4 tidak terlihat di layar",
                ],
                correctAnswer: 1,
                explanation:
                  "Meskipun terdapat pola Bullish Engulfing di M15, lokasinya berada tepat di hadapan penghalang Resistance H4 (buying into resistance) sehingga ruang kenaikan sangat sempit dan berisiko tinggi ditolak turun.",
              },
              {
                id: "q2-6-2",
                question: "Apa indikasi utama dari terbentuknya pola Inside Bar (satu atau dua candle kecil yang berada sepenuhnya di dalam rentang High–Low Mother Bar)?",
                options: [
                  "Broker sedang menghentikan kuotasi harga",
                  "Terjadi fase konsolidasi sementara dan kompresi volatilitas sebelum pasar melakukan ekspansi saat batas High atau Low Mother Bar ditembus secara valid",
                  "Tren utama sudah pasti berakhir selamanya",
                  "Spread pasar sedang melebar 500 pips",
                ],
                correctAnswer: 1,
                explanation:
                  "Inside Bar menandakan jeda keseimbangan (kompresi energi/volatilitas) di dalam batas Mother Bar. Penembusan valid terhadap High/Low Mother Bar menjadi pemicu pelepasan momentum berikutnya.",
              },
              {
                id: "q2-6-3",
                question: "Saat harga menguji level Resistance 2700.00 di timeframe H4, candle sempat melonjak ke 2706.50 namun pada penutupan jam ke-4 berakhir di 2696.00 (membentuk Shooting Star / Bearish Pinbar). Apa kesimpulan paling akurat?",
                options: [
                  "Terjadi Breakout bullish yang valid di atas 2700.00",
                  "Terjadi sapuan likuiditas (Liquidity Sweep / False Breakout) di atas 2700.00 di mana penjual menyerap habis order beli dan mengambil alih kendali pada penutupan candle",
                  "Pembeli berhasil mempertahankan harga di atas 2700.00",
                  "Level 2700.00 sudah tidak lagi memiliki arti teknikal",
                ],
                correctAnswer: 1,
                explanation:
                  "Kenaikan sementara ke 2706.50 menyapu Buy Stop / Stop Loss penjual di atas 2700.00, namun penutupan body kembali di 2696.00 (di bawah Resistance) membuktikan penolakan keras dan dominasi penjual.",
              },
              {
                id: "q2-6-4",
                question: "Di manakah penempatan Stop Loss teknikal yang paling objektif ketika Anda melakukan entry Buy berdasarkan konfirmasi Bullish Rejection Pinbar di zona Support?",
                options: [
                  "Tepat di harga pembukaan (Open) Pinbar tersebut",
                  "Beberapa pips di bawah ujung ekstrem sumbu bawah (Low) Pinbar tersebut, karena jika titik terendah sumbu itu ditembus kembali berarti alasan penolakan beli telah batal (invalid)",
                  "Sejauh 500 pips tanpa alasan struktural",
                  "Tidak perlu menggunakan Stop Loss karena Pinbar sudah terkonfirmasi",
                ],
                correctAnswer: 1,
                explanation:
                  "Ujung sumbu bawah (Low) dari Bullish Pinbar adalah batas harga terendah di mana pembeli berhasil menolak penjual. Jika harga kembali menembus titik Low tersebut, maka hipotesis penolakan beli dinyatakan batal.",
              },
            ],
          },
        ],
      },
    ],
  },
];
