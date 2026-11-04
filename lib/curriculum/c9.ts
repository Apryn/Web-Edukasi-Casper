import type { Course } from "../types";

export const coursesC9: Course[] = [
  {
    id: "c9",
    slug: "trading-journal-evaluation",
    number: "SC-09",
    title: "Trading Journal & Evaluation",
    subtitle: "Merekam Data Transaksi, Menghitung Metrik Expectancy & Profit Factor, serta Mengoptimalkan Performa Berbasis Bukti",
    category: "Trading Foundation",
    level: "Intermediate",
    duration: "4 Jam",
    totalLessons: 6,
    instructor: {
      name: "Casper Market Research",
      role: "Lead Trading Analyst",
    },
    overview:
      "Apa yang tidak diukur tidak akan pernah bisa diperbaiki. Banyak trader menghabiskan bertahun-tahun melakukan kesalahan yang sama berulang kali hanya karena mereka tidak pernah mendokumentasikan dan mengaudit transaksi mereka sendiri. Kelas penutup kurikulum Signal Casper Academy ini mengajarkan cara mengubah riwayat transaksi Anda menjadi laboratorium peningkatan performa pribadi: merancang anatomi jurnal trading profesional, menghitung metrik kuantitatif (Win Rate, Profit Factor, Expectancy, Max Drawdown), membedakan hasil vs proses melalui Matriks 4 Kuadran (Good Win, Good Loss, Bad Win, Bad Loss), hingga menjalankan siklus evaluasi mingguan dan bulanan.",
    objectives: [
      "Menyusun struktur template jurnal trading profesional yang mencatat parameter teknis, risiko, visual (screenshot Before/After), dan kondisi psikologis",
      "Menghitung dan menginterpretasikan metrik evaluasi kuantitatif: Win Rate, Average R-Multiple, Profit Factor, Expectancy, dan Maximum Drawdown",
      "Mengklasifikasikan setiap transaksi ke dalam Matriks 4 Kuadran (Good Win, Good Loss, Bad Win, Bad Loss) untuk mengukur skor kepatuhan proses",
      "Melakukan audit review mingguan dan bulanan guna menemukan kebocoran sistem (edge leakage) dan menyempurnakan Trading Plan secara terukur",
    ],
    competencies: [
      "Mampu mendokumentasikan setiap transaksi secara lengkap dan objektif dalam waktu kurang dari 3 menit pasca-eksekusi",
      "Mampu menghitung nilai Expectancy (harapan matematis per transaksi) dan Profit Factor dari blok sampel 20 transaksi",
      "Mampu mendiagnosis pola kesalahan berulang (berdasarkan jam sesi, instrumen, atau kondisi emosi) dan merumuskan tindakan korektif berbasis data",
    ],
    prerequisites: ["Trading Fundamentals", "Technical Analysis Framework", "Risk Management", "Trading Psychology"],
    courseSummary: [
      "Kelas Trading Journal & Evaluation menutup rangkaian kurikulum dengan sistem umpan balik berbasis data nyata akun siswa sendiri.",
      "Siswa telah menguasai anatomi pencatatan jurnal komprehensif serta rumus metrik performa utama (Profit Factor, Expectancy, dan R-Multiple).",
      "Melalui Matriks 4 Kuadran (Good/Bad Win & Loss) dan protokol review berkala, siswa memiliki kerangka kerja mandiri untuk terus bertumbuh sebagai trader profesional.",
    ],
    references: [
      "Mike Bellafiore — One Good Trade & The PlayBook: An Inside Look at How to Think Like a Professional Trader",
      "Brett N. Steenbarger, Ph.D. — Enhancing Trader Performance: Proven Strategies From the Cutting Edge of Trading Psychology",
      "Van K. Tharp — Super Trader: Make Consistent Profits in Good and Bad Markets (System Evaluation & R-Multiples)",
    ],
    modules: [
      {
        id: "m9-1",
        title: "Modul 1: Anatomi Jurnal Profesional & Metrik Evaluasi Kuantitatif",
        description: "Membangun sistem perekaman data transaksi dan menghitung metrik performa statistik.",
        lessons: [
          {
            id: "l9-1",
            slug: "anatomi-jurnal-trading",
            title: "Parameter Wajib & Anatomi Jurnal Trading Profesional",
            duration: "22 Menit",
            type: "reading",
            summary: "Jurnal profesional tidak hanya mencatat untung atau rugi, melainkan merekam alasan struktural, tangkapan layar sebelum/sesudah, dan kepatuhan rencana.",
            visualDiagram: "journal-expectancy",
            learningObjectives: [
              "Memahami mengapa riwayat transaksi bawaan broker (account history) belum cukup untuk disebut sebagai jurnal evaluasi",
              "Menyusun 4 dimensi parameter wajib dalam jurnal: Data Identitas & Risiko, Data Konfluensi Teknis, Bukti Visual (Before & After Screenshot), dan Audit Psikologi",
              "Membedakan antara evaluasi kualitas eksekusi (apakah sesuai rencana) dengan hasil nominal semata",
            ],
            content: [
              "Banyak trader mengira bahwa mereka tidak perlu membuat jurnal karena laporan mutasi akun di platform MetaTrader atau TradingView sudah mencatat harga beli, harga jual, dan jumlah profit/loss. Itu adalah kesalahpahaman besar! Laporan mutasi broker hanyalah kuitansi akuntansi; ia sama sekali tidak mencatat Mengapa Anda membuka transaksi tersebut, bagaimana struktur HTF saat itu, apakah Anda mematuhi checklist 3 konfluensi, dan bagaimana kondisi emosi Anda ketika menekan tombol eksekusi.",
              "Sebuah transaksi yang kebetulan menghasilkan profit tetapi melanggar aturan manajemen risiko sebenarnya adalah sebuah kesalahan buruk yang beruntung (Bad Win). Sebaliknya, sebuah transaksi yang berakhir menyentuh Stop Loss (-1R) tetapi dieksekusi 100% sesuai protokol rencana adalah transaksi yang sangat baik (Good Loss) dalam kerangka probabilitas jangka panjang. Tanpa jurnal yang rinci, Anda tidak akan pernah bisa memisahkan keberuntungan semu dari keahlian sejati.",
              "Agar jurnal Anda berfungsi sebagai cermin evaluasi yang tajam, setiap baris pencatatan wajib memuat 4 kelompok parameter berikut: (1) Parameter Identitas & Waktu: Tanggal, Hari, Sesi Perdagangan (Asia/London/NY), Instrumen, dan Arah (Buy/Sell). (2) Parameter Risiko & Kuantitatif: Harga Entry, Stop Loss, Take Profit, Ukuran Lot, Risiko Awal (1R), dan Hasil Akhir dalam satuan R-Multiple (misal -1.0R atau +2.5R).",
              "(3) Parameter Konfluensi & Bukti Visual: Skor checklist konfluensi (arah HTF, zona SNR/Supply-Demand, trigger LTF) dilengkapi dua tautan tangkapan layar (Screenshot Before saat posisi baru dibuka dan Screenshot After setelah transaksi selesai). (4) Parameter Audit Psikologi & Kepatuhan: Kondisi mental saat entry (Tenang / FOMO / Ragu / Marah) dan status Kepatuhan Aturan (Ya / Tidak).",
            ],
            applicationExample:
              "Contoh Entri Jurnal Transaksi #14: Tanggal: 12 Mei | Sesi: London Open (14.30 WIB) | Pair: XAUUSD | Arah: Buy | Risiko: 1% ($30) | Konfluensi: H4 Bullish + Retest RBS $2,340 + M15 Engulfing (Skor 3/3) | Hasil: +2.5R (+$75) | Emosi: Tenang & Terencana | Kepatuhan SOP: Ya (100% Valid) | Tautan Screenshot Before & After terlampir.",
            caseStudy:
              "Studi Kasus Penemuan Pola Jam Buruk melalui Jurnal: Seorang trader merasa strateginya tidak bekerja karena saldonya jalan di tempat selama 2 bulan. Setelah ia mulai mencatat kolom 'Jam Sesi Entry' di jurnalnya selama 30 transaksi, data menunjukkan fakta mengejutkan: 100% keuntungannya (+16R) berasal dari transaksi yang dibuka antara pukul 14.00–21.00 WIB (Sesi London & awal NY), sedangkan seluruh kerugiannya (-15R) terjadi pada transaksi larut malam di atas pukul 22.30 WIB saat ia sudah mengantuk. Hanya dengan berhenti trading di atas pukul 22.00 WIB berdasarkan temuan jurnalnya, kurva ekuitasnya langsung melonjak.",
            practicalSteps: [
              "Buat tabel jurnal (menggunakan spreadsheet atau aplikasi jurnal) yang memuat 4 kelompok parameter: Identitas/Sesi, Risiko/R-Multiple, Konfluensi/Screenshot, dan Emosi/Kepatuhan.",
              "Ambil tangkapan layar (screenshot) chart Anda tepat setelah membuka posisi (lengkap dengan kotak SL/TP dan catatan alasan entry).",
              "Ambil tangkapan layar kedua setelah transaksi selesai untuk melihat bagaimana harga bereaksi pasca-penutupan.",
              "Isi jurnal segera setelah transaksi selesai selagi ingatan tentang kondisi psikologis Anda masih segar.",
            ],
            commonMistakes: [
              "Hanya mencatat transaksi yang menang dan merasa malas atau malu mencatat transaksi yang kalah (padahal data kekalahan adalah tambang emas evaluasi).",
              "Mencatat keuntungan hanya dalam satuan mata uang dolar tanpa mencatat satuan R-Multiple (sehingga bias saat ukuran modal berubah).",
              "Tidak menyimpan screenshot chart sebelum entry, sehingga saat evaluasi akhir minggu sudah lupa bagaimana bentuk struktur harga saat itu.",
            ],
            keyTakeaways: [
              "Jurnal trading adalah laboratorium pribadi untuk memisahkan keputusan berbasis sistem dari kebetulan semu.",
              "Selalu rekam bukti visual Before & After serta kondisi emosi di samping angka untung/rugi.",
              "Transaksi yang patuh rencana namun berakhir -1R adalah eksekusi yang benar dalam bisnis probabilitas.",
            ],
            quiz: [
              {
                id: "q9-1-1",
                question: "Mengapa menyimpan dua tangkapan layar (Screenshot Before saat entry dan Screenshot After saat transaksi selesai) sangat penting di dalam jurnal trading?",
                options: [
                  "Untuk dipamerkan ke media sosial ketika kebetulan menang besar",
                  "Untuk membandingkan secara objektif apakah rencana analisis awal saat entry sudah sesuai standar dan mengevaluasi bagaimana pergerakan harga sebenarnya setelah transaksi ditutup",
                  "Karena diwajibkan oleh pihak penyedia layanan internet",
                  "Untuk menghabiskan kapasitas penyimpanan komputer",
                ],
                correctAnswer: 1,
                explanation: "Perbandingan visual Before dan After memungkinkan trader mengaudit ketepatan pemetaan zona awal serta menilai apakah penutupan posisi dilakukan secara optimal atau prematur.",
              },
            ],
          },
          {
            id: "l9-2",
            slug: "metrik-evaluasi-kuantitatif-expectancy-dan-profit-factor",
            title: "Metrik Evaluasi Kuantitatif: Win Rate, Profit Factor, Expectancy, dan Maximum Drawdown",
            duration: "25 Menit",
            type: "chart-study",
            summary: "Cara menghitung rapor kesehatan sistem trading Anda menggunakan 4 rumus statistik standar industri.",
            learningObjectives: [
              "Menghitung Win Rate, Loss Rate, Average Win (dalam R), dan Average Loss (dalam R) dari sampel transaksi",
              "Menghitung dan menginterpretasikan Profit Factor (Total Gross Profit dibagi Total Gross Loss)",
              "Menghitung Mathematical Expectancy (harapan hasil bersih per transaksi) untuk membuktikan apakah sistem Anda memiliki keunggulan positif (positive edge)",
            ],
            content: [
              "Setelah Anda mengumpulkan minimal 20 transaksi di dalam jurnal, bagaimana cara mengetahui secara ilmiah apakah sistem trading Anda benar-benar memiliki keunggulan matematis (edge) atau tidak? Anda tidak bisa menilainya hanya dari satu angka Win Rate. Dalam audit performa kuantitatif, terdapat 4 metrik utama yang wajib Anda hitung pada setiap akhir blok 20 transaksi.",
              "Metrik 1 — Win Rate & Average Win/Loss Ratio: Win Rate adalah persentase jumlah transaksi menang dibagi total transaksi (misal 10 menang dari 20 transaksi = 50%). Pasangkan selalu angka ini dengan Average Win (rata-rata kemenangan dalam satuan R, misal +2.2R) dan Average Loss (rata-rata kekalahan dalam satuan R, yang idealnya terjaga ketat di sekitar -1.0R).",
              "Metrik 2 — Profit Factor (PF): Profit Factor mengukur berapa dolar (atau berapa R) keuntungan kotor yang dihasilkan untuk setiap 1 unit kerugian kotor. Rumusnya: Profit Factor = Total Gross Profit / Total Gross Loss (dalam nilai absolut). Jika selama 20 transaksi total seluruh kemenangan Anda berjumlah +20R dan total seluruh kekalahan Anda berjumlah 10R, maka Profit Factor Anda adalah 20 / 10 = 2.00. (Interpretasi standar: PF < 1.0 berarti sistem merugi; PF 1.0 = impas; PF 1.5 – 2.0 = sistem sehat dan menguntungkan; PF > 2.0 = performa sangat solid).",
              "Metrik 3 — Expectancy (Harapan Matematis per Transaksi): Inilah metrik paling krusial yang menunjukkan berapa rata-rata R yang akan Anda kantongi per satu transaksi dalam jangka panjang. Rumusnya: Expectancy = (Win Rate × Average Win) − (Loss Rate × Average Loss). Contoh: Jika Win Rate Anda 45% (0.45) dengan rata-rata menang +2.4R, dan Loss Rate Anda 55% (0.55) dengan rata-rata kalah 1.0R, maka Expectancy = (0.45 × 2.4R) − (0.55 × 1.0R) = 1.08R − 0.55R = +0.53R per transaksi! Artinya, setiap kali Anda mengeksekusi transaksi sesuai sistem—terlepas apakah transaksi kali ini menang atau kalah—secara statistik setiap klik bernilai +0.53R bagi pertumbuhan akun Anda. Metrik 4 — Maximum Drawdown (MDD): Penurunan terbesar dari puncak ekuitas tertinggi (peak) ke lembah terendah berikutnya (trough) sebelum mencetak puncak baru, yang wajib dijaga tetap di bawah batas toleransi risiko.",
            ],
            chartData: {
              title: "Kurva Ekuitas & Distribusi R-Multiple pada Sampel 20 Transaksi (Expectancy +0.53R, Profit Factor 1.96)",
              description: "Meskipun terdapat fase 4 kekalahan beruntun di tengah sampel, kombinasi Win Rate 45% dan Average Win +2.4R menghasilkan kemiringan kurva ekuitas yang menanjak stabil.",
              timeframe: "20-Trade Block",
              bias: "Bullish",
            },
            applicationExample:
              "Rapor Evaluasi Blok 20 Transaksi Trader Casper: Jumlah Transaksi = 20 | Menang = 8 (Win Rate 40%) | Kalah = 12 (Loss Rate 60%) | Rata-rata Menang = +2.5R (Total Gross Profit = 8 × 2.5R = +20R) | Rata-rata Kalah = 1.0R (Total Gross Loss = 12 × 1.0R = 12R). Maka: (1) Hasil Bersih = +8R. (2) Profit Factor = 20R / 12R = 1.67. (3) Expectancy = (0.40 × 2.5R) − (0.60 × 1.0R) = 1.00R − 0.60R = +0.40R per transaksi.",
            caseStudy:
              "Studi Kasus Mendiagnosis Kebocoran via Average Loss: Seorang trader memiliki Win Rate bagus sebesar 55% dan Average Win +1.8R, namun pada akhir bulan akunnya justru minus. Ketika dihitung metriknya, ternyata nilai Average Loss-nya mencapai -2.6R (bukan -1.0R) karena pada 3 transaksi ia mencabut Stop Loss dan membiarkan kerugian membengkak hingga -4R. Jurnal kuantitatif langsung menunjukkan bahwa mesin analisisnya sudah bagus, dan satu-satunya hal yang harus diperbaiki adalah mengunci batas rugi maksimal di -1.0R.",
            practicalSteps: [
              "Gunakan satuan R-Multiple pada setiap catatan jurnal agar perhitungan metrik tidak terdistorsi oleh perubahan saldo modal.",
              "Setiap genap 20 transaksi selesai, hitung 4 angka rapor Anda: Win Rate (%), Profit Factor, Expectancy (R), dan Max Drawdown (%).",
              "Pastikan nilai Average Loss Anda tidak pernah melebihi 1.0R–1.1R (termasuk biaya komisi dan spread).",
              "Targetkan sistem trading Anda memiliki nilai Expectancy minimal di atas +0.25R per transaksi dan Profit Factor di atas 1.50.",
            ],
            commonMistakes: [
              "Hanya membanggakan persentase Win Rate tanpa menghitung Profit Factor dan Expectancy.",
              "Mengevaluasi rumus statistik hanya dari 3 atau 4 transaksi (sampel terlalu kecil sehingga tidak bermakna secara statistik).",
              "Membiarkan satu kekalahan besar (-5R) merusak nilai Average Loss dari 19 transaksi disiplin lainnya.",
            ],
            keyTakeaways: [
              "Profit Factor = Gross Profit / Gross Loss; angka di atas 1.50 menunjukkan sistem yang sehat dan tangguh.",
              "Expectancy = (Win% × Avg Win) − (Loss% × Avg Loss); nilai positif membuktikan Anda memiliki keunggulan matematis (edge) di pasar.",
              "Jaga Average Loss tetap terkunci di -1R agar keunggulan Average Win (+2R ke atas) dapat bekerja maksimal.",
            ],
            quiz: [
              {
                id: "q9-2-1",
                question: "Dalam 20 transaksi terakhir, seorang trader mencatat Total Keuntungan Kotor (Gross Profit) sebesar +18R dan Total Kerugian Kotor (Gross Loss) sebesar 9R. Berapakah nilai Profit Factor (PF) sistem trader tersebut?",
                options: [
                  "0.50",
                  "1.00",
                  "2.00",
                  "9.00",
                ],
                correctAnswer: 2,
                explanation: "Profit Factor = Total Gross Profit / Total Gross Loss = 18R / 9R = 2.00 (artinya menghasilkan 2 unit keuntungan untuk setiap 1 unit kerugian).",
              },
            ],
          },
          {
            id: "l9-3",
            slug: "evaluasi-modul-1-jurnal-dan-metrik",
            title: "Evaluasi Modul 1: Dokumentasi & Metrik Statistik Jurnal",
            duration: "15 Menit",
            type: "quiz",
            summary: "Uji penguasaan Anda atas parameter wajib jurnal trading serta perhitungan Profit Factor dan Expectancy.",
            learningObjectives: [
              "Mengevaluasi kelengkapan komponen pencatatan dalam jurnal trading profesional",
              "Menghitung nilai Profit Factor dan Expectancy dari data statistik sampel transaksi",
              "Menginterpretasikan arti angka rapor kuantitatif terhadap kesehatan sistem trading",
            ],
            content: [
              "Selamat menyelesaikan Modul 1 pada kelas Trading Journal & Evaluation. Anda kini mampu mengubah kumpulan transaksi menjadi metrik statistik yang objektif dan terukur.",
              "Kerjakan evaluasi Modul 1 ini dengan skor minimal 70% sebelum memasuki Modul 2 tentang Audit Kepatuhan Proses (Matriks 4 Kuadran) dan Siklus Review Mingguan/Bulanan.",
            ],
            applicationExample:
              "Soal-soal berikut menguji kemampuan Anda menghitung langsung metrik performa dari data jurnal transaksi.",
            caseStudy:
              "Trader yang mengetahui angka Expectancy positif sistemnya secara pasti (+0.4R per trade) terbukti jauh lebih tenang saat menghadapi fase drawdown normal dibanding trader yang bertransaksi dalam kegelapan data.",
            practicalSteps: [
              "Hitung dengan teliti soal Profit Factor dan Expectancy di bawah ini.",
              "Capai skor minimal 70% untuk membuka Modul 2.",
            ],
            commonMistakes: [
              "Tertukar antara rumus Profit Factor (pembagian) dengan rumus Net Profit (pengurangan).",
            ],
            keyTakeaways: [
              "Data jurnal yang jujur adalah kompas navigasi terbaik bagi peningkatan performa trader.",
              "Sistem dengan Win Rate 40%–50% sudah sangat menguntungkan apabila ditopang Expectancy positif dan Profit Factor > 1.5.",
            ],
            quiz: [
              {
                id: "q9-3-1",
                question: "Seorang trader memiliki Win Rate 50% (0.50) dengan rata-rata kemenangan (Average Win) sebesar +2.0R, dan Loss Rate 50% (0.50) dengan rata-rata kekalahan (Average Loss) sebesar 1.0R. Berapakah nilai Expectancy per transaksi dari sistem tersebut?",
                options: [
                  "-0.50R per transaksi",
                  "0.00R (Impas)",
                  "+0.50R per transaksi",
                  "+2.00R per transaksi",
                ],
                correctAnswer: 2,
                explanation: "Expectancy = (Win Rate × Avg Win) − (Loss Rate × Avg Loss) = (0.50 × 2.0R) − (0.50 × 1.0R) = 1.00R − 0.50R = +0.50R per transaksi.",
              },
              {
                id: "q9-3-2",
                question: "Mengapa pencatatan hasil transaksi di dalam jurnal sangat disarankan menggunakan satuan 'R-Multiple' (misal -1R, +2.5R) di samping nilai nominal uang?",
                options: [
                  "Karena satuan R-Multiple menyembunyikan kerugian dari broker",
                  "Karena satuan R-Multiple menstandarisasi performa berdasarkan unit risiko, sehingga kualitas eksekusi tetap dapat dibandingkan secara objektif meskipun ukuran modal akun bertambah atau berkurang seiring waktu",
                  "Karena mata uang dolar tidak bisa dijumlahkan di dalam tabel",
                  "Karena R-Multiple membuat semua transaksi otomatis menjadi profit",
                ],
                correctAnswer: 1,
                explanation: "Jika saldo akun tumbuh dua kali lipat, nilai dolar per transaksi berubah, tetapi nilai rasio risiko R-Multiple (+2R vs -1R) tetap konsisten untuk dievaluasi.",
              },
              {
                id: "q9-3-3",
                question: "Manakah di bawah ini yang merupakan kesimpulan tepat apabila sebuah sistem trading memiliki nilai Profit Factor sebesar 0.75 setelah 30 transaksi?",
                options: [
                  "Sistem tersebut sangat menguntungkan dan siap digandakan ukuran lotnya",
                  "Sistem atau eksekusi trader tersebut sedang merugi (Total Gross Profit lebih kecil daripada Total Gross Loss), sehingga wajib dihentikan sementara untuk diaudit letak kebocorannya",
                  "Trader tersebut tidak pernah mengalami kekalahan sama sekali",
                  "Nilai 0.75 berarti Win Rate trader adalah 75% dengan RRR 1:3",
                ],
                correctAnswer: 1,
                explanation: "Profit Factor di bawah 1.00 menunjukkan bahwa total keuntungan kotor lebih kecil dibanding total kerugian kotor (ekspektasi negatif).",
              },
            ],
          },
        ],
      },
      {
        id: "m9-2",
        title: "Modul 2: Audit Kepatuhan Proses (4-Quadrant Matrix) & Siklus Review Berkala",
        description: "Memisahkan kualitas proses dari hasil jangka pendek dan menjalankan protokol evaluasi mingguan serta bulanan.",
        lessons: [
          {
            id: "l9-4",
            slug: "audit-kepatuhan-proses-matriks-4-kuadran",
            title: "Audit Kepatuhan Proses: Matriks 4 Kuadran (Good Win, Good Loss, Bad Win, dan Bad Loss)",
            duration: "24 Menit",
            type: "reading",
            summary: "Mengapa kemenangan yang melanggar aturan (Bad Win) jauh lebih berbahaya bagi masa depan akun Anda daripada kekalahan yang patuh aturan (Good Loss).",
            learningObjectives: [
              "Mengklasifikasikan setiap transaksi ke dalam 4 kuadran berdasarkan dimensi Kualitas Proses (Patuh vs Melanggar SOP) dan Hasil (Untung vs Rugi)",
              "Memahami bahaya psikologis dari 'Bad Win' yang memberikan penguatan positif palsu (false positive reinforcement) terhadap kebiasaan buruk",
              "Menghitung Execution Compliance Score (Skor Kepatuhan Eksekusi) dengan target minimal 90% transaksi berada di Kuadran Proses Benar",
            ],
            content: [
              "Dalam kehidupan sehari-hari, kita terbiasa menilai kualitas sebuah tindakan dari hasil akhirnya: jika untung berarti pintar, jika rugi berarti salah. Namun di dunia probabilitas pasar finansial, cara penilaian seperti itu disebut Resulting Fallacy dan sangat merusak perkembangan seorang trader. Untuk mengevaluasi diri secara profesional, Anda wajib memetakan setiap transaksi di jurnal ke dalam Matriks 4 Kuadran Proses vs Hasil:",
              "Kuadran 1 — GOOD WIN (Proses Benar + Hasil Profit): Anda mengikuti seluruh syarat 3 konfluensi, menghitung lot dengan benar (risiko 1%), menunggu trigger konfirmasi, dan harga mencapai target Take Profit. Ini adalah standar ideal yang memperkuat kepercayaan diri sistem.",
              "Kuadran 2 — GOOD LOSS (Proses Benar + Hasil Stop Loss -1R): Anda sudah mengikuti 100% aturan Trading Plan dan checklist konfluensi dengan sempurna, namun karena distribusi probabilitas pasar, kali ini harga berbalik menyentuh Stop Loss sebesar -1R. Dalam audit profesional, Good Loss mendapat nilai kepatuhan A+! Anda sama sekali tidak boleh mengubah sistem atau merasa bersalah atas Good Loss, karena ini adalah biaya operasional bisnis yang sah.",
              "Kuadran 3 — BAD LOSS (Proses Melanggar + Hasil Rugi): Anda masuk pasar karena FOMO di pucuk harga, melakukan Revenge Trading tanpa konfluensi, atau memperbesar lot melebihi batas, lalu berakhir menyentuh Stop Loss. Ini adalah kesalahan murni yang 100% dapat dicegah dan wajib dieliminasi.",
              "Kuadran 4 — BAD WIN (Proses Melanggar + Hasil Profit): Anda melanggar aturan—misalnya mencabut Stop Loss saat posisi sedang floating minus parah lalu menambah lot (averaging loss), dan secara kebetulan harga berbalik sehingga Anda menutup posisi dalam keadaan untung. Mengapa Bad Win adalah kuadran PALING BERBAHAYA di antara keempatnya? Karena otak Anda mendapatkan hadiah uang dari tindakan melanggar aturan! Penguatan positif palsu ini membuat Anda mengulangi pelanggaran serupa di masa depan hingga akhirnya satu tren kuat menyapu bersih 100% modal akun Anda.",
            ],
            applicationExample:
              "Cara menghitung Skor Kepatuhan Eksekusi (Execution Compliance Score) pada akhir bulan (20 transaksi): Jumlah transaksi Good Win = 8 | Good Loss = 10 | Bad Win = 1 | Bad Loss = 1. Maka Skor Kepatuhan = (Good Win + Good Loss) / Total Transaksi = (8 + 10) / 20 = 18 / 20 = 90%. Fokus utama trader bulan depan adalah menghapus 2 transaksi pelanggaran (Bad Win & Bad Loss) agar kepatuhan mencapai 100%.",
            caseStudy:
              "Studi Kasus Pembersihan Kuadran Bad Loss: Seorang trader mendapati hasil bulanan akunnya hanya untung tipis +1R dari 25 transaksi. Setelah dikelompokkan ke dalam Matriks 4 Kuadran: 10 Good Win (+22R), 9 Good Loss (-9R), 1 Bad Win (+1R), dan 5 Bad Loss akibat FOMO/Revenge (-13R). Terlihat jelas bahwa sistem intinya (Good Win + Good Loss) sebenarnya mencetak profit bersih +13R! Seluruh kerja kerasnya habis digerogoti oleh 5 transaksi Bad Loss. Kesadaran visual ini membuatnya berhenti menyalahkan strategi teknikal dan fokus mendisiplinkan aturan jeda emosi.",
            practicalSteps: [
              "Tambahkan satu kolom khusus bernama 'Kuadran Evaluasi' di jurnal Anda dengan 4 pilihan: [Good Win], [Good Loss], [Bad Win], atau [Bad Loss].",
              "Jangan pernah merayakan keuntungan yang berasal dari kategori Bad Win; catat transaksi tersebut sebagai pelanggaran merah yang tidak boleh diulangi.",
              "Berikan apresiasi pada diri sendiri ketika berhasil mengeksekusi Good Loss secara tenang dan terukur tepat sebesar -1R.",
              "Hitung persentase (Good Win + Good Loss) terhadap total transaksi setiap minggu dan jaga di atas 90%.",
            ],
            commonMistakes: [
              "Merasa bangga dan pintar setelah berhasil lolos dari floating loss besar tanpa Stop Loss (terjebak ilusi Bad Win).",
              "Marah-marah dan merombak seluruh strategi setelah mengalami Good Loss yang sebenarnya sudah sesuai SOP.",
              "Menyembunyikan transaksi Bad Loss dari perhitungan evaluasi mingguan.",
            ],
            keyTakeaways: [
              "Nilai diri Anda dari kualitas kepatuhan proses (Good Win & Good Loss), bukan semata-mata dari hasil uang satu transaksi.",
              "Good Loss adalah bagian tak terpisahkan dari sistem ber-Expectancy positif.",
              "Bad Win adalah bom waktu psikologis yang melatih kebiasaan menghancurkan akun.",
            ],
            quiz: [
              {
                id: "q9-4-1",
                question: "Mengapa sebuah transaksi yang termasuk kategori 'Bad Win' (melanggar aturan manajemen risiko namun kebetulan berakhir profit) dianggap jauh lebih berbahaya daripada 'Good Loss'?",
                options: [
                  "Karena Bad Win membuat pajak transaksi menjadi lebih mahal",
                  "Karena Bad Win memberikan hadiah dopamin/keuntungan atas tindakan yang salah (seperti melepas Stop Loss atau overleveraging), sehingga melatih trader mengulangi kebiasaan mematikan tersebut hingga kelak menghancurkan seluruh akun",
                  "Karena Good Loss selalu menghasilkan uang tunai seketika",
                  "Karena broker akan memblokir akun yang mengalami Bad Win",
                ],
                correctAnswer: 1,
                explanation: "Keberhasilan semu dari pelanggaran aturan menciptakan ilusi kekebalan terhadap risiko yang pada akhirnya berujung pada kerugian katastrofik saat pasar bergerak satu arah.",
              },
            ],
          },
          {
            id: "l9-5",
            slug: "siklus-review-mingguan-bulanan-dan-iterasi-trading-plan",
            title: "Siklus Review Mingguan & Bulanan: Mengidentifikasi Kebocoran Sistem (Edge Leakage) dan Iterasi Trading Plan",
            duration: "25 Menit",
            type: "reading",
            summary: "Panduan langkah demi langkah melakukan audit akhir pekan dan akhir bulan untuk terus menajamkan performa trading Anda.",
            learningObjectives: [
              "Menjalankan SOP Weekly Review (30 menit setiap akhir pekan) dan Monthly Review (setiap akhir bulan / per 20 transaksi)",
              "Mengidentifikasi titik kebocoran performa (Edge Leakage) baik dari sisi teknis maupun perilaku",
              "Melakukan pembaruan (iterasi) Trading Plan secara terukur dengan prinsip 'ubah satu variabel dalam satu waktu'",
            ],
            content: [
              "Perbedaan terbesar antara trader yang stagnan selama bertahun-tahun dengan trader yang terus berkembang terletak pada apa yang mereka lakukan saat pasar tutup di akhir pekan. Trader profesional menjalankan Siklus Umpan Balik Berkelanjutan (Continuous Feedback Loop): Rencanakan (Plan) → Eksekusi (Execute) → Rekam di Jurnal (Record) → Evaluasi (Review) → Perbaiki (Refine).",
              "Bagaimana prosedur melakukan Weekly Review (Evaluasi Mingguan) yang efektif hanya dalam waktu 30 menit setiap hari Sabtu atau Minggu? Langkah 1: Kumpulkan seluruh tangkapan layar (Before & After) transaksi minggu tersebut. Langkah 2: Hitung Skor Kepatuhan Eksekusi Anda (berapa persen transaksi berada di kuadran Good Win & Good Loss). Langkah 3: Cari 'Satu Kebocoran Utama' (Top Leak) minggu itu—misalnya apakah Anda masih sering menggeser SL terlalu cepat ke Breakeven sebelum harga mencetak struktur baru, atau apakah Anda masih tergoda masuk 10 menit sebelum berita rilis? Langkah 4: Tetapkan 'Satu Tujuan Fokus Proses' untuk minggu depan (misal: 'Minggu depan saya hanya fokus memastikan setiap entry memiliki konfirmasi candle close di M15').",
              "Selanjutnya, setiap akhir bulan (atau setiap terkumpul genap 20 transaksi), lakukan Monthly Deep Audit dengan membedah data jurnal berdasarkan tiga filter pembanding: (1) Filter Sesi & Waktu: Sesi manakah (Asia, London, atau New York) yang menyumbang Profit Factor tertinggi dan terendah bagi Anda? (2) Filter Instrumen: Apakah Anda jauh lebih konsisten di XAUUSD dibanding di pasangan silang (cross pairs)? (3) Filter Setup: Apakah setup Continuation (BOS + Retest) memiliki Win Rate lebih tinggi bagi Anda dibandingkan setup Reversal (CHoCH)?",
              "Aturan Emas Iterasi Trading Plan: Ketika Anda ingin menyempurnakan Trading Plan berdasarkan temuan data bulanan, patuhi prinsip ilmiah 'Ubah Satu Variabel dalam Satu Waktu' (Change One Variable at a Time) dan uji kembali selama 20 transaksi berikutnya. Jangan pernah merombak seluruh timeframe, indikator, dan aturan risiko sekaligus setiap minggu, karena Anda tidak akan tahu perubahan mana yang membawa perbaikan atau kemunduran.",
            ],
            applicationExample:
              "Hasil Monthly Audit & Iterasi Plan: Dari data 20 transaksi bulan Mei, seorang trader menemukan bahwa 4 dari 6 transaksinya yang diambil pada hari Jumat malam di atas pukul 21.00 WIB berakhir rugi karena likuiditas pasar mulai mengering menjelang penutupan mingguan. Berdasarkan bukti data ini, ia menambahkan satu klausa perbaikan pada Trading Plan bulan Juni: 'Batas waktu maksimal membuka posisi baru di hari Jumat adalah pukul 20.30 WIB.'",
            caseStudy:
              "Studi Kasus Pertumbuhan Konsisten melalui Fokus Proses: Selama Kuartal 1, seorang trader berhenti mengejar target 'harus profit X dolar per bulan' dan menggantinya dengan target proses bertahap dari evaluasi mingguan: Bulan 1 fokus 100% disiplin menghitung ukuran lot (tidak ada lagi lot tebak-tebakan); Bulan 2 fokus hanya mengambil setup dengan skor konfluensi 3/3; Bulan 3 fokus tidak menyentuh posisi setelah SL dan TP terpasang. Pada akhir Kuartal 1, Profit Factor-nya meningkat alami dari 0.85 menjadi 1.92.",
            practicalSteps: [
              "Jadwalkan waktu tetap selama 30 menit setiap akhir pekan khusus untuk melakukan Weekly Review atas jurnal transaksi Anda.",
              "Identifikasi maksimal 1 kesalahan proses paling dominan dari minggu lalu dan tuliskan 1 aturan korektif spesifik untuk minggu depan.",
              "Setiap genap 20 transaksi, lakukan pengelompokan hasil berdasarkan Instrumen, Sesi Waktu, dan Jenis Setup untuk melihat di mana keunggulan (edge) terkuat Anda berada.",
              "Pangkas kebiasaan, jam trading, atau instrumen yang secara statistik terbukti terus menggerogoti profit Anda (edge leakage).",
            ],
            commonMistakes: [
              "Menulis jurnal dengan rajin setiap hari tetapi tidak pernah membuka dan membacanya kembali untuk dievaluasi pada akhir pekan.",
              "Mengubah seluruh aturan Trading Plan hanya karena baru mengalami 2 kali Good Loss di awal minggu.",
              "Menetapkan terlalu banyak target perbaikan sekaligus sehingga tidak ada satu pun yang terlaksana dengan fokus.",
            ],
            keyTakeaways: [
              "Jurnal tanpa evaluasi berkala hanyalah tumpukan arsip; kekuatan sejati jurnal muncul saat Weekly dan Monthly Review.",
              "Gunakan data jurnal Anda untuk memangkas kebocoran (jam buruk, setup lemah, impuls emosi) dan menggandakan fokus pada area terkuat Anda.",
              "Lakukan iterasi Trading Plan secara bertahap per 20 sampel transaksi berdasarkan bukti statistik, bukan perasaan sesaat.",
            ],
            quiz: [
              {
                id: "q9-5-1",
                question: "Apa prinsip yang benar ketika seorang trader hendak melakukan penyesuaian atau penyempurnaan (iterasi) pada aturan Trading Plan-nya?",
                options: [
                  "Mengganti seluruh metode analisis setiap hari Selasa dan Kamis",
                  "Melakukan perubahan berdasarkan bukti data dari sampel minimal 20 transaksi di jurnal, serta hanya mengubah satu variabel spesifik dalam satu waktu agar dampaknya dapat diukur secara objektif",
                  "Meniru mentah-mentah pengaturan indikator orang lain tanpa pernah mengujinya",
                  "Menghapus aturan manajemen risiko agar jumlah transaksi bisa lebih banyak",
                ],
                correctAnswer: 1,
                explanation: "Pendekatan ilmiah dalam pengembangan sistem menuntut ukuran sampel yang memadai (20+ transaksi) dan isolasi satu variabel perubahan agar efektivitasnya terukur jelas.",
              },
            ],
          },
          {
            id: "l9-6",
            slug: "final-assessment-trading-journal-evaluation",
            title: "Final Assessment: Trading Journal, Evaluation & Complete Curriculum Mastery",
            duration: "20 Menit",
            type: "quiz",
            summary: "Ujian akhir pencatatan jurnal, analisis metrik Expectancy & Profit Factor, Matriks 4 Kuadran, serta integrasi utuh kurikulum Signal Casper Academy.",
            learningObjectives: [
              "Menguji penguasaan menyeluruh atas anatomi jurnal, perhitungan metrik kuantitatif, dan audit kepatuhan proses",
              "Memvalidasi kemampuan mendiagnosis masalah performa trading menggunakan data jurnal",
              "Menuntaskan rangkaian perjalanan belajar dari tingkat pemula hingga lanjutan di Signal Casper Academy",
            ],
            content: [
              "Selamat mencapai garis akhir dari kelas Trading Journal & Evaluation (SC-09) sekaligus puncak dari seluruh kurikulum Signal Casper Academy! Anda telah menempuh perjalanan lengkap mulai dari fondasi mekanisme pasar (C1), psikologi candlestick (C2), struktur pasar BOS/CHoCH (C3), zona Support-Resistance & Supply-Demand (C4), kerangka konfluensi Top-Down (C5), spesialisasi pasar emas XAUUSD (C6), matematika manajemen risiko (C7), ketangguhan psikologi probabilitas (C8), hingga evaluasi mandiri berbasis jurnal (C9).",
              "Selesaikan Final Assessment ini dengan skor minimal 70% untuk menuntaskan kelas SC-09 dan meraih penguasaan utuh atas metode perdagangan sistematis.",
            ],
            applicationExample:
              "Assessment ini menguji kemampuan analisis evaluasi mandiri yang akan terus Anda gunakan sepanjang karier Anda sebagai trader.",
            caseStudy:
              "Kelulusan dari kurikulum akademi bukanlah akhir dari proses belajar, melainkan awal dari praktik disiplin yang terukur melalui siklus Trading Plan dan Jurnal Evaluasi.",
            practicalSteps: [
              "Periksa kembali rumus Expectancy, Profit Factor, dan klasifikasi Matriks 4 Kuadran Anda.",
              "Pastikan nilai akhir mencapai minimal 70% untuk menuntaskan kelas SC-09.",
            ],
            commonMistakes: [
              "Mengabaikan evaluasi proses saat akun sedang mengalami fase profit.",
            ],
            keyTakeaways: [
              "Trader profesional adalah manajer risiko dan pengaudit data atas sistemnya sendiri.",
              "Konsistensi jangka panjang lahir dari sinergi tak terpisahkan antara Analisis Teknikal Objektif, Manajemen Risiko Ketat, Psikologi Probabilitas, dan Evaluasi Jurnal.",
            ],
            quiz: [
              {
                id: "q9-6-1",
                question: "Manakah di bawah ini yang diklasifikasikan sebagai 'Good Loss' di dalam Matriks 4 Kuadran evaluasi jurnal trading?",
                options: [
                  "Transaksi yang dibuka karena FOMO di pucuk harga tanpa konfluensi lalu menyentuh Stop Loss",
                  "Transaksi yang dieksekusi 100% mematuhi aturan Trading Plan (memenuhi 3 konfluensi, lot sesuai rumus risiko 1%, menunggu trigger valid), namun harga berbalik menyentuh Stop Loss sebesar -1R karena faktor distribusi probabilitas pasar",
                  "Transaksi yang awalnya rugi besar karena tidak memasang Stop Loss lalu ditutup paksa oleh broker (Margin Call)",
                  "Transaksi balas dendam (Revenge Trading) yang berakhir rugi",
                ],
                correctAnswer: 1,
                explanation: "Good Loss adalah transaksi yang seluruh proses perencanaannya dan eksekusinya sudah benar sesuai SOP, di mana hasil -1R merupakan bagian wajar dari probabilitas statistik.",
              },
              {
                id: "q9-6-2",
                question: "Dari sampel 20 transaksi di jurnal, seorang trader memiliki Win Rate 40% (8 menang) dengan rata-rata menang +3.0R, dan Loss Rate 60% (12 kalah) dengan rata-rata kalah 1.0R. Berapakah nilai Profit Factor dan Expectancy per transaksi trader tersebut?",
                options: [
                  "Profit Factor = 1.00 dan Expectancy = 0.00R",
                  "Profit Factor = 2.00 (Gross Profit 24R / Gross Loss 12R) dan Expectancy = +0.60R per transaksi",
                  "Profit Factor = 0.50 dan Expectancy = -0.60R per transaksi",
                  "Profit Factor = 3.00 dan Expectancy = +3.00R per transaksi",
                ],
                correctAnswer: 1,
                explanation: "Gross Profit = 8 × 3.0R = 24R; Gross Loss = 12 × 1.0R = 12R → Profit Factor = 24 / 12 = 2.00. Expectancy = (0.40 × 3.0R) − (0.60 × 1.0R) = 1.20R − 0.60R = +0.60R per transaksi.",
              },
              {
                id: "q9-6-3",
                question: "Saat melakukan Monthly Audit atas 30 transaksi di jurnal, Anda menemukan bahwa Skor Kepatuhan Eksekusi Anda hanya 60%, di mana 12 transaksi yang melanggar aturan (Bad Loss) terjadi karena Anda sering membuka posisi impulsif di luar jam sesi rencana. Apa langkah perbaikan yang paling tepat?",
                options: [
                  "Mengganti seluruh konsep Market Structure dan Support-Resistance dengan 10 indikator baru",
                  "Mempertahankan strategi teknikal inti yang sudah terbukti menghasilkan Good Win, sambil menerapkan aturan pembatasan jam sesi dan Price Alert untuk mengeliminasi transaksi impulsif (Bad Loss)",
                  "Menaikkan risiko per transaksi menjadi 10% agar cepat balik modal",
                  "Berhenti menulis jurnal agar kesalahan tersebut tidak terlihat lagi",
                ],
                correctAnswer: 1,
                explanation: "Ketika data jurnal menunjukkan bahwa kerugian berasal dari pelanggaran disiplin (Bad Loss) dan bukan dari kegagalan sistem inti, solusi yang tepat adalah memperbaiki kepatuhan eksekusi.",
              },
              {
                id: "q9-6-4",
                question: "Manakah urutan alur kerja terpadu (End-to-End Professional Trading Workflow) yang merangkum seluruh kurikulum Signal Casper Academy dari C1 hingga C9 secara benar?",
                options: [
                  "Buka chart M1 → tebak arah candle → masuk lot maksimal tanpa Stop Loss → berharap untung",
                  "Pahami mekanisme & likuiditas pasar (C1) → Petakan Market Structure & Zona SNR/Supply-Demand secara Top-Down dengan 3 Konfluensi & konteks Makro/Sesi (C3, C4, C5, C6) → Tunggu Trigger Candlestick di LTF (C2) → Hitung Position Sizing & kunci batas Risiko -1R (C7) → Eksekusi dengan tenang dalam kerangka probabilitas 20-sampel (C8) → Dokumentasikan & evaluasi di Jurnal Trading (C9)",
                  "Cari sinyal di media sosial → gandakan lot setiap kalah (Martingale) → salahkan pasar jika rugi",
                  "Hanya menghafal teori tanpa pernah menghitung ukuran lot maupun mencatat jurnal evaluasi",
                ],
                correctAnswer: 1,
                explanation: "Sinergi ke-9 kelas membentuk siklus kerja trader profesional yang utuh: Analisis Struktur & Konfluensi → Konfirmasi Price Action → Manajemen Risiko Presisi → Disiplin Psikologi → Audit Jurnal Berkelanjutan.",
              },
            ],
          },
        ],
      },
    ],
  },
];

