import type { Course } from "../types";

export const coursesC3C4: Course[] = [
  {
    id: "c3",
    slug: "market-structure",
    number: "SC-03",
    title: "Market Structure Mastery",
    subtitle: "Membaca Peta Besar: HH, HL, LH, LL, Break of Structure, Change of Character & Multi-Timeframe Alignment",
    category: "Market Structure",
    level: "Intermediate",
    duration: "4.5 Jam",
    totalLessons: 6,
    featured: true,
    instructor: {
      name: "Casper Market Research",
      role: "Lead Trading Analyst",
    },
    overview:
      "Struktur pasar (Market Structure) adalah kerangka tulang punggung dari seluruh analisis teknikal profesional. Tanpa peta struktur yang objektif, seorang trader mudah terjebak membeli di ujung reli (buying the top) atau menjual di dasar koreksi (selling the bottom). Kelas ini mengajarkan cara memvalidasi Swing High/Low mekanis, membedakan Break of Structure (BOS) dari Change of Character (CHoCH), memahami konsep Protected High/Low dan Inducement, serta menyelaraskan struktur Higher Timeframe (HTF) dengan eksekusi Lower Timeframe (LTF).",
    objectives: [
      "Mengidentifikasi titik Swing High dan Swing Low yang valid secara mekanis tanpa bias subjektif",
      "Membedakan aturan validasi Break of Structure (BOS) sebagai kelanjutan tren dan Change of Character (CHoCH) sebagai sinyal awal pergeseran tren",
      "Memahami hierarki Fractal Market Structure: menyelaraskan struktur eksternal (H4/D1) dengan struktur internal (M15/H1)",
      "Mengenali jebakan struktur minor (Inducement) agar tidak menempatkan Stop Loss di area yang mudah disapu",
    ],
    competencies: [
      "Mampu menentukan arah bias struktur utama (Bullish, Bearish, atau Ranging) pada grafik apa pun dalam waktu kurang dari 2 menit",
      "Mampu membedakan kapan koreksi harga hanyalah pullback sehat (Internal Structure) dan kapan merupakan pembalikan tren sejati (CHoCH)",
      "Mampu merancang skenario entry mengikuti penyelarasan HTF dan LTF (Top-Down Structural Alignment)",
    ],
    prerequisites: [
      "Telah menyelesaikan kelas SC-01: Trading Fundamentals dan SC-02: Candlestick & Price Action",
      "Memahami aturan validasi penutupan body candle (Candle Close)",
    ],
    courseSummary: [
      "Tren naik (Bullish) ditandai oleh rangkaian Higher High (HH) dan Higher Low (HL), sedangkan tren turun (Bearish) ditandai oleh Lower High (LH) dan Lower Low (LL).",
      "Break of Structure (BOS) mengonfirmasi kelanjutan tren yang sedang berlangsung dan wajib divalidasi oleh penutupan body candle (Candle Close), bukan sekadar tusukan sumbu.",
      "Change of Character (CHoCH) terjadi ketika harga mematahkan titik Swing HL terakhir yang menghasilkan HH tertinggi (atau LH terakhir yang menghasilkan LL terendah).",
      "Penurunan harga di timeframe kecil (M15) sering kali hanyalah koreksi internal untuk membentuk Higher Low pada timeframe besar (H4)—selalu utamakan bias struktur HTF.",
    ],
    references: [
      "Murphy, J. J. (1999). Technical Analysis of the Financial Markets. New York Institute of Finance.",
      "Wyckoff, R. D. (1931). The Richard D. Wyckoff Method of Trading and Investing in Stocks.",
      "Schabacker, R. W. (1932). Technical Analysis and Stock Market Profits: A Course in Forecasting.",
    ],
    modules: [
      {
        id: "m3-1",
        title: "Modul 1: Mekanika Swing Points, BOS, dan CHoCH",
        description: "Menentukan titik acuan struktural yang objektif serta membedakan kelanjutan tren dari pembalikan arah.",
        lessons: [
          {
            id: "l3-1",
            slug: "definisi-swing-high-low-valid",
            title: "Swing High & Swing Low yang Valid: Mekanika HH, HL, LH, dan LL",
            duration: "20 Menit",
            type: "reading",
            summary: "Menghilangkan subjektivitas dalam menandai titik ayunan harga (swing point) dengan aturan penutupan body dan proteksi struktur.",
            learningObjectives: [
              "Mendefinisikan urutan mekanis Higher High (HH) – Higher Low (HL) pada tren naik dan Lower Low (LL) – Lower High (LH) pada tren turun",
              "Menjelaskan konsep Protected Low (pada uptrend) dan Protected High (pada downtrend)",
              "Membedakan ayunan harga struktural dari fluktuasi candle minor di dalam satu kaki impulsif",
            ],
            visualDiagram: "market-structure-bos-choch",
            content: [
              "Harga di pasar finansial tidak pernah bergerak dalam satu garis lurus vertikal. Harga bergerak menyerupai gelombang yang terdiri dari dua fase bergantian: Fase Impulsif (ekspansi searah tren utama) dan Fase Korektif (retracement / pullback melawan tren sementara untuk mengambil napas likuiditas).",
              "Dalam tren naik (Bullish Structure), gelombang impulsif mencetak puncak baru yang lebih tinggi (Higher High / HH), diikuti gelombang korektif yang berhenti di atas lembah sebelumnya (Higher Low / HL). Aturan mekanis yang tidak boleh dilanggar adalah: sebuah lembah belum sah disebut sebagai Higher Low (HL) struktural yang terproteksi (Protected Low) sebelum lembah tersebut berhasil mendorong harga naik dan menutup body candle di atas puncak Higher High sebelumnya.",
              "Sebaliknya, dalam tren turun (Bearish Structure), gelombang impulsif mencetak lembah baru yang lebih rendah (Lower Low / LL), diikuti gelombang korektif yang tertahan di bawah puncak sebelumnya (Lower High / LH). Puncak koreksi tersebut baru sah menjadi Lower High (LH) struktural yang terproteksi (Protected High) apabila dari titik tersebut penjual berhasil menekan harga turun dan menutup body candle di bawah Lower Low sebelumnya.",
              "Mengapa aturan ini sangat krusial? Banyak trader pemula menandai setiap pantulan 2–3 candle kecil di tengah perjalanan harga sebagai HL atau LH baru, lalu menempatkan Stop Loss tepat di baliknya. Padahal, ayunan kecil yang belum berhasil menembus struktur ekstrem sebelumnya hanyalah likuiditas internal yang sangat rentan disapu sebelum tren utama benar-benar berlanjut.",
            ],
            applicationExample:
              "Pada grafik XAUUSD H4, harga naik dari 2600 (HL) ke 2650 (HH), lalu turun terkoreksi ke 2620, naik sebentar ke 2640 (gagal menembus 2650), dan turun lagi ke 2612 sebelum akhirnya reli menembus dan tutup di 2665. Titik 2620 bukanlah HL struktural utama karena dari 2620 harga gagal melampaui 2650; titik HL struktural yang sah adalah 2612 karena dari 2612 harga berhasil mencetak HH baru di 2665.",
            caseStudy:
              "Seorang trader menandai ayunan kecil di 2620 sebagai HL dan menaruh Stop Loss Buy di 2618. Ketika harga melakukan sapuan sehat ke 2612 (masih jauh di atas HL utama 2600) sebelum terbang ke 2665, posisi trader tersebut terkena Stop Loss hanya karena salah mengidentifikasi ayunan internal sebagai Swing Low utama.",
            practicalSteps: [
              "Buka grafik H4 dan tandai 5 titik puncak dan lembah utama terakhir menggunakan aturan: lembah HL baru sah jika berhasil menembus HH sebelumnya dengan penutupan body candle.",
              "Hubungkan titik-titik tersebut secara berurutan untuk melihat dengan jelas apakah pasar sedang berada dalam fase Bullish (HH–HL) atau Bearish (LH–LL).",
              "Tandai satu titik Protected Low (jika Bullish) atau Protected High (jika Bearish) paling akhir sebagai batas pertahanan tren saat ini.",
            ],
            commonMistakes: [
              "Menganggap setiap candle merah kecil dalam reli naik sebagai pembentukan Higher Low yang sudah final.",
              "Menggunakan tusukan sumbu (wick) tipis tanpa penutupan body candle sebagai pengesahan penembusan struktur.",
              "Tidak memperbarui titik acuan struktur setelah terjadi penembusan baru.",
            ],
            keyTakeaways: [
              "Higher Low (HL) baru sah tervalidasi setelah berhasil mencetak Higher High (HH) baru melalui penutupan body candle.",
              "Lower High (LH) baru sah tervalidasi setelah berhasil mencetak Lower Low (LL) baru melalui penutupan body candle.",
              "Selama Protected Low (pada uptrend) atau Protected High (pada downtrend) belum ditembus, arah tren utama tetap sah.",
            ],
            quiz: [
              {
                id: "q3-1-inline-1",
                question: "Dalam sebuah tren naik (uptrend) dari 2600 (HL) menuju 2650 (HH), kapan sebuah titik koreksi di 2625 sah dikukuhkan sebagai Higher Low (HL) struktural yang baru?",
                options: [
                  "Begitu muncul satu candle hijau ukuran kecil di 2625",
                  "Setelah pantulan dari 2625 berhasil mendorong harga naik dan menutup body candle di atas puncak HH 2650",
                  "Ketika indikator RSI menyentuh level 50",
                  "Setelah 15 menit berlalu sejak harga menyentuh 2625",
                ],
                correctAnswer: 1,
                explanation:
                  "Sebuah titik koreksi baru tervalidasi sebagai Swing Higher Low (Protected Low) setelah gelombang naik dari titik tersebut mampu menembus dan menutup body candle di atas Higher High sebelumnya (2650).",
              },
            ],
          },
          {
            id: "l3-2",
            slug: "bos-vs-choch",
            title: "BOS (Break of Structure) vs CHoCH (Change of Character)",
            duration: "22 Menit",
            type: "chart-study",
            summary: "Membedakan secara presisi sinyal kelanjutan tren (BOS) dari peringatan dini patahnya struktur tren (CHoCH).",
            learningObjectives: [
              "Mendefinisikan Break of Structure (BOS) sebagai bukti konfirmasi kelanjutan tren",
              "Mendefinisikan Change of Character (CHoCH) sebagai penembusan pertama terhadap Protected HL/LH",
              "Menghindari kesalahan menandai CHoCH palsu pada ayunan minor yang bukan penghasil ekstrem tertinggi/terendah",
            ],
            content: [
              "Dua istilah paling penting dalam pemetaan struktur modern adalah BOS (Break of Structure) dan CHoCH (Change of Character). Membedakan keduanya secara mekanis menentukan apakah Anda harus terus mengikuti tren (trend-following) atau bersiap menghadapi pergeseran arah (reversal).",
              "Break of Structure (BOS) terjadi SEARAH dengan tren yang sedang berjalan. Dalam tren naik (Bullish), BOS terjadi setiap kali harga menembus dan menutup body candle di atas Higher High (HH) sebelumnya. Dalam tren turun (Bearish), BOS terjadi setiap kali harga menembus dan menutup body candle di bawah Lower Low (LL) sebelumnya. Setiap kali BOS terbentuk, kita memperoleh konfirmasi bahwa kekuatan dominan masih memegang kendali dan kita menunggu fase pullback untuk masuk searah tren.",
              "Change of Character (CHoCH) terjadi MELAWAN tren yang sedang berlangsung dan merupakan indikasi pertama bahwa struktur tren telah patah. Dalam tren naik, CHoCH Bearish terjadi apabila penjual berhasil menekan harga turun dan menutup body candle DI BAWAH titik Higher Low (HL) terakhir yang menghasilkan puncak HH tertinggi. Sebaliknya, dalam tren turun, CHoCH Bullish terjadi apabila pembeli berhasil mendorong harga naik dan menutup body candle DI ATAS titik Lower High (LH) terakhir yang menghasilkan lembah LL terendah.",
              "Aturan validasi CHoCH yang wajib dipatuhi: titik yang ditembus HARUS merupakan Swing HL/LH sah yang mencetak titik ekstrem terakhir. Jika harga hanya menembus ayunan kecil di tengah-tengah candle sebelum mencapai HL utama, itu bukanlah CHoCH struktural, melainkan hanya pergeseran struktur internal sementara.",
            ],
            applicationExample:
              "Pada XAUUSD H1, harga bergerak naik: 2630 (HL1) -> 2660 (HH1) -> 2645 (HL2) -> 2680 (HH2). Titik HL terakhir yang menghasilkan puncak 2680 adalah 2645. Ketika kemudian penjual menekan harga turun dan candle H1 ditutup tegas di 2641 (di bawah 2645), maka sah terjadi Bearish CHoCH. Trader tidak lagi mencari Buy langsung, melainkan menunggu pullback pembentukan Lower High (LH) untuk skenario Sell.",
            caseStudy:
              "Studi kasus XAUUSD H1: Setelah mencetak HH di 2680, harga mematahkan HL 2645 (Bearish CHoCH), lalu memantul korektif ke zona 2662–2668 membentuk Lower High (LH), sebelum akhirnya jatuh menembus 2641 (Bearish BOS) menuju 2615.",
            chartData: {
              title: "Transisi BOS Bullish Menjadi Bearish CHoCH pada XAUUSD H1",
              description: "Setelah reli panjang HH–HL, harga mematahkan Higher Low terakhir dengan penutupan body candle tegas (CHoCH), diikuti pullback Lower High sebelum ekspansi turun.",
              timeframe: "H1",
              bias: "Bearish",
            },
            practicalSteps: [
              "Pada grafik H1 atau H4 yang sedang tren naik, beri label 'BOS' pada setiap penembusan HH sebelumnya.",
              "Tandai satu garis horizontal tepat pada titik HL terakhir yang menciptakan HH paling pucuk, dan beri label 'Batas CHoCH'.",
              "Selama harga masih berada di atas garis Batas CHoCH tersebut, pertahankan bias Bullish; ubah bias menjadi Bearish hanya jika body candle ditutup di bawah garis tersebut.",
            ],
            commonMistakes: [
              "Mengejar entry Market Sell tepat di dasar candle yang baru saja menembus garis CHoCH tanpa menunggu pantulan koreksi (pullback Lower High).",
              "Menyebut setiap penembusan candle M1/M5 sebagai CHoCH besar dan langsung melawan tren H4/D1.",
              "Menganggap tusukan sumbu (wick) tipis di bawah HL sebagai CHoCH yang sah padahal sebenarnya adalah Liquidity Sweep.",
            ],
            keyTakeaways: [
              "BOS = Kelanjutan tren searah (menembus HH pada uptrend, menembus LL pada downtrend).",
              "CHoCH = Pergeseran karakter tren pertama kali (menembus Protected HL pada uptrend, menembus Protected LH pada downtrend).",
              "Setelah CHoCH terkonfirmasi, strategi paling terukur adalah menunggu retracement (pembentukan HL atau LH pertama) untuk entry dengan rasio Risk-to-Reward optimal.",
            ],
            quiz: [
              {
                id: "q3-2-inline-1",
                question: "Apa perbedaan esensial antara Break of Structure (BOS) dan Change of Character (CHoCH) dalam sebuah tren naik (Bullish)?",
                options: [
                  "BOS terjadi saat harga menembus Higher High (konfirmasi kelanjutan naik), sedangkan CHoCH terjadi saat harga menembus dan tutup di bawah Higher Low terakhir (indikasi awal pembalikan turun)",
                  "BOS hanya terjadi di hari Senin sedangkan CHoCH hanya terjadi di hari Jumat",
                  "BOS dan CHoCH memiliki arti yang sama persis",
                  "CHoCH terjadi setiap kali harga membentuk candle hijau baru",
                ],
                correctAnswer: 0,
                explanation:
                  "Dalam tren naik, penembusan Higher High adalah kelanjutan struktur (BOS), sedangkan patahnya Higher Low terakhir yang menopang puncak tersebut adalah perubahan karakter arah (CHoCH).",
              },
            ],
          },
          {
            id: "l3-3",
            slug: "kuis-market-structure",
            title: "Kuis Evaluasi Modul 1: Validasi Struktur, BOS, dan CHoCH",
            duration: "12 Menit",
            type: "quiz",
            summary: "Evaluasi wajib Modul 1 untuk menguji ketepatan identifikasi Swing Point, BOS, dan CHoCH.",
            learningObjectives: [
              "Menguji ketepatan membedakan BOS dan CHoCH pada struktur Bullish maupun Bearish",
              "Menguji pemahaman syarat penutupan body candle dalam pengesahan struktur",
              "Mengevaluasi penentuan titik Protected High dan Protected Low",
            ],
            content: [
              "Selesaikan evaluasi Modul 1 ini untuk memastikan Anda telah menguasai fondasi mekanis penentuan titik struktur, BOS, dan CHoCH sebelum masuk ke materi penyelarasan Multi-Timeframe di Modul 2.",
              "Batas nilai kelulusan adalah minimal 70%.",
            ],
            applicationExample:
              "Menggunakan peta BOS dan CHoCH untuk menentukan apakah pasar masih dalam fase tren lanjut atau sudah berbalik arah.",
            caseStudy:
              "Pengujian skenario urutan gelombang harga pada struktur tren naik dan tren turun.",
            practicalSteps: [
              "Baca urutan titik harga pada setiap pertanyaan dengan teliti.",
              "Pilih jawaban yang tepat dan kirim untuk verifikasi server.",
            ],
            commonMistakes: [
              "Terbalik antara arah penembusan BOS dan CHoCH pada tren turun.",
            ],
            keyTakeaways: [
              "Ketepatan membaca BOS dan CHoCH menghindarkan Anda dari melawan arus utama institusi.",
              "BOS maupun CHoCH hanya sah apabila dikonfirmasi oleh penutupan body candle di luar batas struktur.",
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
                explanation:
                  "Dalam tren turun, kelanjutan struktur (BOS) ditandai dengan ditembusnya Lower Low sebelumnya oleh harga baru yang lebih rendah.",
              },
              {
                id: "q3-1-2",
                question: "Dalam tren turun dengan urutan: 2700 (LH1) ➔ 2660 (LL1) ➔ 2680 (LH2) ➔ 2640 (LL2), pada level berapakah terkonfirmasi terjadi Bullish CHoCH?",
                options: [
                  "Saat harga turun menembus 2640",
                  "Saat harga naik dan menutup body candle di atas 2680 (LH2 yang menghasilkan LL2 terendah)",
                  "Saat harga baru memantul 5 pips dari 2640 ke 2645",
                  "Saat harga menyentuh 2660",
                ],
                correctAnswer: 1,
                explanation:
                  "Titik Lower High terakhir yang bertanggung jawab mencetak lembah terendah 2640 (LL2) adalah 2680 (LH2). Penembusan dan penutupan body di atas 2680 mematahkan struktur turun dan mengonfirmasi Bullish CHoCH.",
              },
              {
                id: "q3-1-3",
                question: "Apa yang terjadi secara struktural apabila harga menembus Higher High sebelumnya hanya dengan sumbu tipis (wick), lalu body candle ditutup kembali di bawah Higher High tersebut?",
                options: [
                  "Tetap sah sebagai Bullish BOS yang sangat kuat",
                  "Belum sah sebagai BOS, melainkan berpotensi menjadi Liquidity Sweep (sapuan likuiditas) terhadap order Buy Stop di atas puncak tersebut",
                  "Grafik harga otomatis direset oleh bursa",
                  "Tren langsung berubah menjadi Bearish tanpa perlu menembus HL",
                ],
                correctAnswer: 1,
                explanation:
                  "BOS yang valid membutuhkan penutupan body candle di luar level struktur. Jika hanya berupa tusukan sumbu (wick), itu mengindikasikan sapuan likuiditas dan penolakan harga.",
              },
            ],
          },
        ],
      },
      {
        id: "m3-2",
        title: "Modul 2: Multi-Timeframe Structure (HTF vs LTF) & Inducement",
        description: "Menyelaraskan peta struktur timeframe tinggi dengan pemicu timeframe rendah serta menghindari jebakan likuiditas internal.",
        lessons: [
          {
            id: "l3-4",
            slug: "multi-timeframe-fractal-structure",
            title: "Sinkronisasi Multi-Timeframe: Struktur Eksternal (HTF) vs Struktur Internal (LTF)",
            duration: "24 Menit",
            type: "reading",
            summary: "Memahami sifat fraktal pasar: mengapa tren turun di M15 sering kali hanyalah koreksi sehat untuk membentuk Higher Low di H4.",
            learningObjectives: [
              "Menjelaskan konsep Fractal Market Structure antara Higher Timeframe (HTF) dan Lower Timeframe (LTF)",
              "Membedakan fase Pro-Trend (LTF searah HTF) dan Counter-Trend / Pullback (LTF berlawanan sementara dengan HTF)",
              "Menyusun alur kerja penyelarasan 2-Timeframe (H4 + M15 atau D1 + H1) untuk eksekusi presisi",
            ],
            content: [
              "Pasar keuangan bersifat fraktal: di dalam satu gelombang naik pada timeframe H4, terdapat puluhan gelombang naik-turun yang lebih kecil pada timeframe M15. Kebingungan terbesar trader terjadi ketika mereka melihat grafik H4 sedang Bullish, tetapi saat membuka grafik M15 mereka melihat struktur Bearish (LH–LL)—lalu mereka bingung apakah harus Buy atau Sell.",
              "Untuk menyelesaikan kebingungan ini secara permanen, pisahkan struktur menjadi dua tingkatan: Struktur Eksternal / Swing (pada HTF seperti H4 atau D1) dan Struktur Internal (pada LTF seperti M15 atau H1). Struktur HTF menentukan arah arus sungai utama (Directional Bias), sedangkan Struktur LTF digunakan untuk memantau apakah fase koreksi (pullback) sudah selesai atau belum.",
              "Mari kita telusuri siklus lengkapnya pada tren naik H4: (1) Ketika H4 baru saja mencetak Bullish BOS (menembus HH), harga di H4 akan memasuki fase koreksi turun untuk mencari pijakan Higher Low (HL). (2) Selama H4 sedang turun terkoreksi itulah, grafik M15 akan menampilkan tren turun internal (rangkaian LH dan LL kecil menuju zona diskon H4). Pada fase ini, trader disiplin TIDAK terburu-buru melakukan Buy selama M15 masih terus mencetak LL baru.",
              "(3) Begitu harga di M15 menyentuh zona diskon/Support H4, kita menunggu grafik M15 mematahkan Lower High internal terakhirnya (membentuk Bullish CHoCH di M15). Momen terjadinya Bullish CHoCH di M15 tepat di dalam zona HL H4 adalah sinyal bahwa fase koreksi telah selesai dan struktur LTF kini kembali selaras (aligned) dengan struktur Bullish HTF!",
            ],
            applicationExample:
              "Struktur H4 XAUUSD sedang Bullish dengan rentang ayunan 2620 (HL) ke 2680 (HH). Harga terkoreksi turun menuju zona permintaan H4 di 2635–2642. Selama perjalanan turun dari 2680 ke 2640, grafik M15 berbentuk downtrend. Sesampainya di 2638, M15 membentuk Bullish CHoCH dengan menembus LH M15 di 2644. Trader melakukan entry Buy pada pullback M15 di 2640 dengan Stop Loss di 2634 (60 pips) dan target menuju HH H4 di 2680 (400 pips, RRR > 1:6).",
            caseStudy:
              "Perbandingan dua trader pada skenario yang sama: Trader 1 terjebak melakukan Sell di 2638 karena hanya melihat M15 yang sedang turun tanpa menyadari bahwa 2638 adalah dasar zona Higher Low H4. Trader 2 memetakan H4 terlebih dahulu, menunggu M15 berbalik menjadi Bullish di zona 2638, dan mendapatkan reli ekspansi penuh searah tren H4.",
            practicalSteps: [
              "Tetapkan pasangan timeframe tetap Anda: misalnya H4 sebagai peta arah (HTF) dan M15 sebagai ruang eksekusi (LTF), atau D1 (HTF) dan H1 (LTF).",
              "Gambar batas Swing High dan Swing Low terakhir pada HTF, lalu bagi rentang tersebut menjadi 50% (garis Equilibrium): area di bawah 50% adalah zona Discount (ideal untuk mencari HL Buy pada uptrend), dan area di atas 50% adalah zona Premium (ideal untuk mencari LH Sell pada downtrend).",
              "Tunggu harga masuk ke zona Discount/Premium HTF, lalu turun ke LTF untuk menunggu konfirmasi CHoCH searah HTF.",
            ],
            commonMistakes: [
              "Melakukan transaksi Sell di dasar zona Discount H4 hanya karena melihat grafik M5/M15 sedang turun tajam.",
              "Melakukan entry Buy di zona Premium (dekat pucuk HH H4) sebelum terjadi koreksi yang memadai.",
              "Terlalu sering berpindah-pindah di antara 6 timeframe sekaligus sehingga kehilangan acuan struktur utama.",
            ],
            keyTakeaways: [
              "HTF menentukan arah bias utama (Storyline), sedangkan LTF menentukan waktu eksekusi (Timing).",
              "Tren turun pada M15 di dalam tren naik H4 hanyalah fase retracement menuju pembentukan Higher Low H4.",
              "Eksekusi probabilitas tertinggi terjadi pada titik temu saat struktur LTF kembali berbalik searah dengan struktur HTF.",
            ],
            quiz: [
              {
                id: "q3-4-inline-1",
                question: "Apabila grafik H4 sedang berada dalam tren Bullish yang jelas dan saat ini harga sedang bergerak turun menuju area Discount H4, apa fungsi utama mengamati struktur M15?",
                options: [
                  "Untuk ikut melakukan Sell di dasar harga karena M15 sedang merah",
                  "Untuk memantau kapan tren turun korektif di M15 patah (membentuk Bullish CHoCH di M15) sebagai tanda bahwa Higher Low H4 sudah siap terbentuk dan harga siap melanjutkan tren naik H4",
                  "Untuk menggantikan seluruh analisis H4 dengan M15",
                  "Tidak ada gunanya melihat M15 sama sekali",
                ],
                correctAnswer: 1,
                explanation:
                  "Ketika HTF (H4) sedang pullback turun, LTF (M15) akan menampilkan struktur turun internal. Terjadinya Bullish CHoCH pada M15 di dalam zona Discount H4 mengonfirmasi berakhirnya pullback dan penyelarasan kembali LTF dengan tren naik H4.",
              },
            ],
          },
          {
            id: "l3-5",
            slug: "inducement-dan-jebakan-likuiditas-struktur",
            title: "Inducement (IDM) & Jebakan Struktur Minor: Mengapa HL Pertama Sering Disapu",
            duration: "20 Menit",
            type: "reading",
            summary: "Memahami bagaimana institusi memanfaatkan ayunan koreksi pertama (Inducement) sebagai bahan bakar likuiditas sebelum harga memantul dari zona ekstrem.",
            learningObjectives: [
              "Mendefinisikan konsep Inducement (IDM) sebagai jebakan ayunan internal pertama setelah BOS",
              "Menjelaskan mengapa menempatkan order terlalu dini sebelum sapuan Inducement memiliki tingkat kegagalan tinggi",
              "Mengidentifikasi zona reaksi struktural yang berada di bawah/atas titik Inducement",
            ],
            content: [
              "Pernahkah Anda mengalami kejadian di mana Anda sudah mengidentifikasi tren naik dengan benar, lalu membeli pada pantulan koreksi pertama setelah BOS, namun harga justru turun menyapu Stop Loss Anda sedikit saja sebelum akhirnya terbang tinggi sesuai arah analisis Anda? Fenomena tersebut terjadi karena Anda membeli tepat pada titik Inducement (IDM).",
              "Secara mekanisme likuiditas, setelah harga mencetak Higher High baru (BOS), trader retail yang takut ketinggalan (early buyers) akan langsung membeli pada ayunan pantulan kecil pertama di dekat puncak, dan menempatkan Stop Loss mereka tepat di bawah ayunan kecil tersebut. Kumpulan Stop Loss dari para pembeli prematur inilah yang disebut sebagai Inducement (umpan likuiditas internal).",
              "Bagi institusi besar yang ingin mengakumulasi posisi Buy dalam ukuran ratusan hingga ribuan lot, mereka membutuhkan lawan transaksi (penjual) dalam jumlah besar di harga diskon. Oleh karena itu, harga hampir selalu didorong turun terlebih dahulu untuk menyapu titik Inducement tersebut—memicu Stop Loss pembeli awal menjadi Market Sell—sehingga institusi dapat menyerap likuiditas tersebut pada zona permintaan (Demand / Support) yang lebih dalam di dekat titik awal impuls.",
              "Aturan praktis yang akan meningkatkan kualitas eksekusi struktur Anda secara drastis: setelah terjadi BOS, perhatikan ayunan pullback minor pertama yang terbentuk. Jangan langsung membeli di ayunan pertama tersebut; biarkan likuiditas di bawah ayunan pertama itu disapu terlebih dahulu menuju zona diskon di bawahnya, barulah cari konfirmasi pantulan.",
            ],
            applicationExample:
              "Setelah XAUUSD menembus HH di 2670 dan mencapai 2685, harga turun sedikit ke 2676 lalu memantul ke 2682. Titik 2676 adalah Inducement (IDM) bagi pembeli terburu-buru. Saat sesi berikutnya dibuka, harga turun menyapu 2676 menuju zona Demand H1 di 2662 (di mana awal reli bermula), membentuk Rejection Pinbar di 2662, lalu reli ke 2700.",
            caseStudy:
              "Evaluasi terhadap 50 setup trend-following menunjukkan bahwa menunggu sapuan terhadap ayunan koreksi minor pertama (Inducement) sebelum melakukan entry mengurangi frekuensi terkena Stop Loss prematur sebesar lebih dari 40%.",
            practicalSteps: [
              "Setiap kali melihat BOS baru, tandai ayunan koreksi kecil pertama yang terbentuk di dekat puncak/lembah ekstrem sebagai kandidat Inducement (IDM).",
              "Periksa apakah di bawah titik IDM tersebut (pada uptrend) masih terdapat zona Support/Demand yang belum teruji (unmitigated) di area Discount.",
              "Bersabarlah menunggu harga menyapu titik IDM tersebut dan masuk ke zona Discount sebelum mencari konfirmasi trigger LTF.",
            ],
            commonMistakes: [
              "Membeli pada pantulan pertama di zona Premium (dekat pucuk HH) tepat setelah BOS terjadi.",
              "Menganggap sapuan terhadap Inducement sebagai patahnya tren utama (padahal Protected HL utama di bawahnya sama sekali belum tertembus).",
              "Menggeser Stop Loss ke titik impas (breakeven) terlalu cepat di bawah ayunan minor yang belum terproteksi.",
            ],
            keyTakeaways: [
              "Inducement (IDM) adalah umpan likuiditas berupa ayunan minor pertama yang menyimpan Stop Loss para trader yang masuk terlalu cepat.",
              "Sapuan terhadap Inducement di dalam rentang tren adalah hal yang sehat dan menjadi bahan bakar bagi kelanjutan tren utama.",
              "Selalu bedakan antara ayunan minor internal (IDM) dan titik Protected Swing HL/LH utama.",
            ],
            quiz: [
              {
                id: "q3-5-inline-1",
                question: "Mengapa membeli langsung pada pantulan koreksi kecil pertama tepat di dekat puncak Higher High (zona Premium) sering berakhir terkena Stop Loss sebelum harga kembali naik?",
                options: [
                  "Karena tren naik sudah berubah menjadi tren turun permanen",
                  "Karena ayunan kecil pertama di dekat puncak tersebut berfungsi sebagai Inducement (umpan likuiditas) yang umumnya disapu terlebih dahulu untuk mengisi antrean beli institusi di zona Discount yang lebih bawah",
                  "Karena aturan bursa melarang pembelian setelah BOS",
                  "Karena harga tidak pernah melakukan pullback lebih dari 5 pips",
                ],
                correctAnswer: 1,
                explanation:
                  "Ayunan minor pertama di dekat puncak menyimpan kumpulan Stop Loss pembeli prematur (Inducement). Harga lazimnya menyapu likuiditas tersebut menuju zona Discount sebelum melanjutkan tren naik utama.",
              },
            ],
          },
          {
            id: "l3-6",
            slug: "final-assessment-market-structure",
            title: "Final Assessment: Ujian Komprehensif Market Structure Mastery",
            duration: "15 Menit",
            type: "quiz",
            summary: "Ujian akhir kelulusan kelas SC-03 Market Structure Mastery (Batas kelulusan: 70%).",
            learningObjectives: [
              "Menguji penguasaan komprehensif atas Swing Point, BOS, CHoCH, Protected High/Low, Multi-Timeframe Alignment, dan Inducement",
              "Memverifikasi kemampuan siswa memetakan arah pasar secara objektif sebelum melanjutkan ke kelas Support & Resistance Dinamis",
            ],
            content: [
              "Selamat datang di Final Assessment kelas SC-03: Market Structure Mastery. Ujian ini mengevaluasi kemampuan analitis Anda dalam membedakan struktur internal vs eksternal, memvalidasi BOS dan CHoCH, serta menghindari jebakan likuiditas Inducement.",
              "Jawab seluruh pertanyaan dengan cermat. Skor minimal 70% diperlukan untuk dinyatakan lulus dan membuka hak klaim Sertifikat Kelulusan kelas SC-03.",
            ],
            applicationExample:
              "Menerapkan analisis struktur Top-Down dari H4 ke M15 untuk menemukan skenario eksekusi searah tren institusional.",
            caseStudy:
              "Integrasi analisis struktur multi-timeframe pada skenario pasar nyata.",
            practicalSteps: [
              "Evaluasi setiap skenario struktural di bawah ini secara mekanis.",
              "Kirim jawaban Anda ke server untuk mendapatkan penilaian dan pembahasan lengkap.",
            ],
            commonMistakes: [
              "Mencampuradukkan struktur internal timeframe rendah dengan struktur utama timeframe tinggi.",
            ],
            keyTakeaways: [
              "Dengan menguasai Market Structure, Anda memiliki kompas objektif untuk mengetahui di sisi pasar mana probabilitas berada.",
              "Sinkronisasi HTF dan LTF setelah sapuan Inducement adalah kunci eksekusi berpresisi tinggi.",
            ],
            quiz: [
              {
                id: "q3-6-1",
                question: "Jika timeframe H4 berada dalam struktur Bullish (HH–HL) dan harga saat ini sedang turun mendekati zona Discount H4 namun belum menembus Protected HL H4, bagaimana status tren utama?",
                options: [
                  "Tren H4 sudah resmi berubah menjadi Bearish",
                  "Tren utama H4 tetap sah Bullish; penurunan saat ini adalah fase koreksi (retracement) untuk membentuk Higher Low baru selama Protected HL H4 belum ditembus dengan penutupan body candle",
                  "Pasar tidak memiliki struktur sama sekali",
                  "Trader wajib langsung melakukan Market Sell di dasar zona Discount",
                ],
                correctAnswer: 1,
                explanation:
                  "Selama titik Protected Higher Low pada H4 belum ditembus oleh penutupan body candle, struktur utama H4 tetap Bullish dan pergerakan turun menuju zona Discount merupakan fase korektif.",
              },
              {
                id: "q3-6-2",
                question: "Kapan momen konfirmasi paling ideal bagi trader untuk mengeksekusi posisi Buy ketika harga sudah masuk ke dalam zona Higher Low (Discount) pada timeframe H4?",
                options: [
                  "Saat candle M15 masih terus mencetak Lower Low tajam tanpa henti",
                  "Saat struktur pada timeframe eksekusi (M15/H1) mematahkan Lower High internalnya (membentuk Bullish CHoCH) yang menandakan selesainya koreksi dan kembalinya keselarasan dengan tren Bullish H4",
                  "Tepat 10 detik sebelum pengumuman suku bunga The Fed",
                  "Saat harga masih berada di pucuk Higher High H4",
                ],
                correctAnswer: 1,
                explanation:
                  "Menunggu terbentuknya Bullish CHoCH pada timeframe rendah (M15/H1) di dalam zona Discount H4 memastikan bahwa momentum jual korektif sudah patah dan pembeli kembali mengambil alih kendali.",
              },
              {
                id: "q3-6-3",
                question: "Apa fungsi mengidentifikasi titik Inducement (IDM) sebelum menempatkan order mengikuti tren?",
                options: [
                  "Agar kita bisa menempatkan seluruh modal pada ayunan pertama setelah BOS",
                  "Agar kita tidak terjebak masuk terlalu dini di area umpan likuiditas yang rawan disapu, melainkan menunggu hingga likuiditas IDM tersebut tersapu ke zona reaksi yang lebih valid",
                  "Untuk menghapus penggunaan Stop Loss",
                  "Untuk menentukan besaran biaya komisi broker",
                ],
                correctAnswer: 1,
                explanation:
                  "Menyadari keberadaan Inducement melindungi trader dari entry prematur di zona mahal dan memastikan eksekusi dilakukan setelah sapuan likuiditas selesai.",
              },
              {
                id: "q3-6-4",
                question: "Manakah dari pernyataan berikut yang BENAR mengenai pembagian zona Premium dan Discount dalam satu rentang struktur ayunan (Swing Range)?",
                options: [
                  "Dalam tren Bullish, zona ideal untuk mencari peluang Buy adalah di zona Discount (di bawah titik keseimbangan 50% rentang ayunan), sedangkan dalam tren Bearish zona ideal mencari peluang Sell adalah di zona Premium (di atas 50%)",
                  "Dalam tren Bullish kita wajib membeli di pucuk tertinggi (100% Premium)",
                  "Zona Discount dan Premium ditentukan secara acak tanpa melihat titik Swing High dan Swing Low",
                  "Dalam tren Bearish kita wajib menjual di titik terendah (0% Discount)",
                ],
                correctAnswer: 0,
                explanation:
                  "Prinsip dasar perdagangan sehat adalah membeli di harga murah (Discount < 50% swing range) saat tren Bullish, dan menjual di harga mahal (Premium > 50% swing range) saat tren Bearish.",
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
    subtitle: "Mengidentifikasi Zona Reaksi Nyata, Mekanisme SBR/RBS, Supply & Demand, serta Kolam Likuiditas",
    category: "Technical Analysis",
    level: "Beginner",
    duration: "3.5 Jam",
    totalLessons: 6,
    instructor: {
      name: "Casper Market Research",
      role: "Lead Trading Analyst",
    },
    overview:
      "Support dan Resistance bukanlah sehelai garis tipis ajaib yang mampu menghentikan harga tepat pada satu angka desimal. Di pasar modern yang digerakkan oleh algoritma dan aliran order institusional, level kunci berwujud sebuah ZONA harga tempat berkumpulnya antrean minat beli (Demand) dan minat jual (Supply). Dalam kelas ini, Anda akan menguasai cara memetakan zona reaksi secara presisi, memanfaatkan fenomena perpindahan fungsi level (SBR dan RBS), menilai kesegaran zona (Fresh vs Tested), serta mengenali jebakan Equal Highs/Lows.",
    objectives: [
      "Mengubah paradigma garis tunggal menjadi pemetaan Zona Probabilitas (Support/Resistance Zone) berbasis rentang body dan wick",
      "Memahami mekanisme mikrostruktur di balik Support Become Resistance (SBR) dan Resistance Become Support (RBS)",
      "Membedakan kualitas zona segar (Fresh / Unmitigated Zone) dari zona yang sudah berulang kali diuji (Heavily Tested Level)",
      "Mengenali kolam likuiditas (Liquidity Pool) pada formasi Equal Highs (Double/Triple Top) dan Equal Lows (Double/Triple Bottom)",
    ],
    competencies: [
      "Mampu menggambar zona Support, Resistance, Supply, dan Demand yang bersih dan konsisten pada grafik H4 dan H1",
      "Mampu mengeksekusi skenario Break-and-Retest (SBR/RBS) dengan penempatan Stop Loss yang terlindung di balik struktur zona",
      "Mampu menghindari jebakan menempatkan Stop Loss tepat di balik level Equal Highs/Lows yang menjadi magnet sapuan likuiditas",
    ],
    prerequisites: [
      "Telah menyelesaikan kelas SC-02: Candlestick & Price Action dan SC-03: Market Structure Mastery",
    ],
    courseSummary: [
      "Support dan Resistance harus selalu dipetakan sebagai ZONA (rentang antara penutupan body candle hingga ujung ekstrem sumbu), bukan satu garis harga tunggal.",
      "Ketika zona Support ditembus tegas, posisinya berbalik fungsi menjadi Resistance (SBR); ketika zona Resistance ditembus tegas, posisinya berbalik menjadi Support (RBS).",
      "Berbeda dengan anggapan ritel klasik, semakin sering sebuah level diuji dalam waktu berdekatan (Equal Highs/Lows), semakin tipis sisa antrean Limit Order di dalamnya dan semakin besar tumpukan Stop Loss di baliknya yang siap disapu.",
      "Zona terbaik untuk ditransaksikan adalah zona yang menjadi titik awal keberangkatan impulsif yang menghasilkan Break of Structure (BOS).",
    ],
    references: [
      "Edwards, R. D., & Magee, J. (2018). Technical Analysis of Stock Trends (11th ed.). CRC Press.",
      "Schwager, J. D. (1999). Getting Started in Technical Analysis. Wiley.",
      "Bouchaud, J.-P., Bonart, J., Donier, J., & Gould, M. (2018). Trades, Quotes and Prices: Financial Markets Under the Microscope. Cambridge University Press.",
    ],
    modules: [
      {
        id: "m4-1",
        title: "Modul 1: Anatomi Zona Reaksi & Mekanisme Role Reversal (SBR/RBS)",
        description: "Mengganti garis kaku menjadi zona probabilitas serta memahami perpindahan fungsi Support dan Resistance.",
        lessons: [
          {
            id: "l4-1",
            slug: "zona-vs-garis",
            title: "Mengapa Level Berupa Zona, Bukan Garis Tunggal",
            duration: "20 Menit",
            type: "reading",
            summary: "Membongkar alasan mikrostruktur mengapa harga jarang memantul pada satu angka eksak dan bagaimana cara menggambar zona reaksi yang benar.",
            learningObjectives: [
              "Menjelaskan mengapa eksekusi order institusional selalu tersebar dalam sebuah rentang harga (zona), bukan pada satu titik harga tunggal",
              "Mempraktikkan teknik penarikan zona Support dan Resistance menggunakan batas Body-to-Wick pada titik ayunan kunci",
              "Menghindari kegagalan transaksi akibat Missed Entry (kurang beberapa pips) maupun Stop Hunt (tersapu tipis di luar garis)",
            ],
            visualDiagram: "snr-zones-sbr-rbs",
            content: [
              "Pasar finansial global dihuni oleh ribuan institusi, bank komersial, algoritma kuantitatif, dan jutaan trader dengan kuotasi Bid/Ask yang sedikit bervariasi antar penyedia likuiditas. Ketika sebuah bank investasi ingin membeli 2.000 lot emas di sekitar harga $2,650, mereka tidak mungkin menaruh seluruh 2.000 lot tersebut tepat di angka 2650.00. Mereka mendistribusikan antrean Limit Buy mereka dalam suatu rentang harga—misalnya mulai dari 2652.00 hingga 2648.50.",
              "Karena antrean order besar tersebar dalam rentang harga, mengharapkan grafik memantul tepat pada sehelai garis tipis adalah kekeliruan fatal. Jika Anda hanya menggambar satu garis tipis di 2650.00, dua hal buruk sering terjadi: (1) Harga turun ke 2651.20 lalu langsung terbang naik tanpa menyentuh garis Anda (Missed Entry), atau (2) Harga turun ke 2648.80 menyentuh Stop Loss sempit Anda sebelum berbalik naik kencang (Stop Hunt).",
              "Cara baku memetakan Zona Support dan Resistance secara objektif adalah menggunakan metode Body-to-Wick pada titik balik struktur (Swing High atau Swing Low): batas dalam zona ditarik dari harga penutupan/pembukaan Real Body candle di titik balik tersebut, sedangkan batas luar zona ditarik hingga ujung paling ekstrem dari sumbu (wick) candle tersebut.",
              "Dengan memandang Support dan Resistance sebagai zona berdimensi lebar (memiliki batas atas dan batas bawah), rencana eksekusi Anda menjadi jauh lebih terukur: Anda mulai waspada mencari konfirmasi begitu harga menyentuh batas dalam zona, dan Anda menempatkan Stop Loss dengan aman di luar batas ekstrem sumbu zona tersebut.",
            ],
            applicationExample:
              "Pada titik Swing Low H4 XAUUSD, candle terendah memiliki body yang ditutup di 2645.00 dan ujung sumbu bawah di 2641.50. Alih-alih menarik satu garis acak di 2643.00, trader menggambar blok persegi panjang (Zona Support) dari 2645.00 hingga 2641.50 (lebar zona 35 pips). Ketika harga kembali menguji area tersebut dan memantul dari 2643.20 dengan konfirmasi Pinbar, trader mengeksekusi Buy dengan Stop Loss di 2639.50 (di bawah batas luar zona).",
            caseStudy:
              "Evaluasi terhadap grafik D1 dan H4 menunjukkan bahwa lebih dari 80% pantulan harga yang valid terjadi di dalam rentang antara batas body dan ujung wick dari titik ayunan sebelumnya, bukan tepat pada satu garis harga tunggal.",
            practicalSteps: [
              "Hapus garis-garis horizontal tunggal yang terlalu rapat di grafik Anda dan ganti dengan blok persegi panjang (Rectangle Tool) pada 3 Swing High dan 3 Swing Low paling signifikan di H4.",
              "Tarik batas zona mulai dari tepi body candle hingga ujung sumbu paling luar pada titik ayunan tersebut.",
              "Pastikan lebar zona proporsional (tidak terlalu lebar hingga memakan separuh layar; gunakan candle titik balik paling ekstrem).",
            ],
            commonMistakes: [
              "Menggambar 15–20 garis horizontal sekaligus di satu grafik hingga harga tidak punya ruang bergerak (over-mapping).",
              "Memotong sumbu candle sesuka hati demi membuat garis tampak rapi menyentuh banyak candle.",
              "Menempatkan Stop Loss di tengah-tengah zona, bukan di luar batas ekstrem zona.",
            ],
            keyTakeaways: [
              "Order institusional terdistribusi dalam rentang harga sehingga level kunci selalu berwujud ZONA.",
              "Gunakan rentang antara tepi Real Body hingga ujung ekstrem Wick pada titik Swing untuk menggambar zona secara konsisten.",
              "Batas dalam zona adalah area pengamatan pemicu (trigger), sedangkan di luar batas ekstrem zona adalah lokasi invalidasi (Stop Loss).",
            ],
            quiz: [
              {
                id: "q4-1-inline-1",
                question: "Bagaimana cara paling objektif untuk menentukan batas atas dan batas bawah sebuah Zona Support pada titik Swing Low?",
                options: [
                  "Menarik satu garis tipis tepat di angka bulat terdekat",
                  "Menarik area persegi panjang dari batas Real Body candle titik balik hingga ujung paling bawah dari sumbu (wick) ekstremnya",
                  "Menggunakan warna candle pertama pada hari Senin",
                  "Menebak lebar zona sebesar 100 pips untuk semua timeframe",
                ],
                correctAnswer: 1,
                explanation:
                  "Metode Body-to-Wick menangkap seluruh area di mana penolakan harga dan penyerapan order terjadi, mulai dari batas penutupan body hingga titik ekstrem sumbu.",
              },
            ],
          },
          {
            id: "l4-2",
            slug: "mekanisme-sbr-dan-rbs",
            title: "Mekanisme Role Reversal: Support Become Resistance (SBR) & Resistance Become Support (RBS)",
            duration: "22 Menit",
            type: "reading",
            summary: "Memahami psikologi pelaku pasar dan aliran order di balik fenomena patahnya level yang berubah fungsi menjadi pijakan pantulan searah tren baru.",
            learningObjectives: [
              "Menjelaskan logika mikrostruktur mengapa Resistance yang ditembus berubah menjadi Support (RBS) dan sebaliknya (SBR)",
              "Membedakan penembusan impulsif yang layak ditunggu retest-nya dari penembusan lemah yang rawan gagal",
              "Menyusun strategi eksekusi Break-and-Retest yang disiplin tanpa mengejar harga saat breakout terjadi",
            ],
            content: [
              "Salah satu fenomena paling konsisten di pasar finansial adalah Role Reversal (perpindahan peran zona): ketika sebuah zona Resistance berhasil ditembus secara tegas ke atas, zona tersebut sering bertransformasi menjadi pijakan Support baru ketika harga terkoreksi turun mengujinya kembali (Resistance Become Support / RBS). Sebaliknya, ketika zona Support ditembus tegas ke bawah, zona tersebut berubah fungsi menjadi atap Resistance baru saat harga memantul naik mengujinya (Support Become Resistance / SBR).",
              "Mengapa hal ini terjadi secara berulang? Ada dua kekuatan mikrostruktur yang bertemu di zona yang baru saja ditembus tersebut: Pertama, para pelaku pasar yang sebelumnya terjebak di sisi yang salah (misalnya penjual di Resistance yang kini posisinya sedang merugi/floating loss karena harga sudah menembus ke atas) sangat berharap harga turun kembali ke titik impas (breakeven) mereka agar mereka bisa menutup posisi jualnya dengan melakukan aksi BELI (Buy to Cover).",
              "Kedua, institusi dan trader yang mendorong penembusan (breakout) tersebut sering kali belum mendapatkan seluruh volume posisi yang mereka inginkan, atau trader disiplin yang sengaja tidak mengejar candle breakout telah memasang antrean Limit Buy tepat di bekas zona Resistance tersebut. Pertemuan antara aksi Buy-to-Cover dari penjual yang terjebak dan antrean Limit Buy baru dari pembeli tren menciptakan dorongan permintaan ganda yang memantulkan harga ke atas!",
              "Namun, tidak semua penembusan menghasilkan SBR/RBS yang valid. Sebuah zona flip (SBR/RBS) hanya berkualitas tinggi apabila: (1) Penembusan awalnya dilakukan oleh candle impulsif ber-body tegas (membuat BOS), dan (2) Saat harga kembali menguji zona tersebut (Retest), pendekatannya bersifat korektif disertai konfirmasi penolakan (Pinbar / Engulfing / CHoCH LTF).",
            ],
            applicationExample:
              "Pada grafik H1 XAUUSD, zona Resistance di 2660–2662 telah menahan harga dua kali. Pada percobaan ketiga di sesi London, candle H1 menembus impulsif dan ditutup di 2670. Trader tidak mengejar Buy di 2670, melainkan menunggu harga melakukan retest korektif kembali ke zona 2660–2662 (kini menjadi RBS). Saat terbentuk Bullish Pinbar di 2661, trader masuk Buy dengan Stop Loss di 2657 dan target 2682.",
            caseStudy:
              "Perbandingan antara mengejar Breakout langsung vs menunggu Retest RBS: mengejar Buy tepat di 2670 memaksa Stop Loss ditaruh jauh di bawah 2657 (130 pips risiko), sedangkan menunggu Retest di 2661 memangkas jarak Stop Loss menjadi hanya 40 pips sekaligus meningkatkan rasio Risk-to-Reward lebih dari 3 kali lipat.",
            practicalSteps: [
              "Tandai zona Support atau Resistance H1/H4 yang baru saja ditembus oleh candle impulsif ber-body tebal.",
              "Ubah warna atau label zona tersebut menjadi 'Kandidat RBS' (jika ditembus ke atas) atau 'Kandidat SBR' (jika ditembus ke bawah).",
              "Tunggu pengujian pertama (First Retest) ke zona tersebut dan cari konfirmasi candlestick penolakan sebelum mengeksekusi posisi.",
            ],
            commonMistakes: [
              "Langsung melakukan FOMO Buy tepat di pucuk candle breakout sebelum terjadi koreksi retest.",
              "Mengandalkan zona SBR/RBS yang sudah ditembus bolak-balik 4–5 kali oleh harga yang sedang konsolidasi menyamping (choppy market).",
              "Masuk posisi dengan buta tanpa menunggu konfirmasi penolakan saat harga kembali menghantam zona dengan momentum tajam.",
            ],
            keyTakeaways: [
              "RBS (Resistance Become Support) dan SBR (Support Become Resistance) digerakkan oleh likuidasi posisi terjebak dan antrean order baru searah penembusan.",
              "Syarat utama SBR/RBS berkualitas tinggi adalah penembusan awal yang tegas (impulsif) diikuti pengujian kembali (First Retest) yang korektif.",
              "Menunggu Retest memberikan harga masuk yang jauh lebih baik dan Stop Loss yang jauh lebih terukur dibanding mengejar candle breakout.",
            ],
            quiz: [
              {
                id: "q4-2-inline-1",
                question: "Apa yang dimaksud dengan skenario Resistance Become Support (RBS) yang valid?",
                options: [
                  "Harga gagal menembus Resistance lalu jatuh tajam",
                  "Zona Resistance berhasil ditembus tegas ke atas oleh penutupan candle impulsif, lalu saat harga turun menguji kembali zona tersebut, zona itu bertahan sebagai pijakan Support baru untuk melanjutkan kenaikan",
                  "Garis Support dihapus dari grafik saat pasar tutup",
                  "Harga bergerak mendatar tanpa menembus level mana pun",
                ],
                correctAnswer: 1,
                explanation:
                  "Dalam skenario RBS, atap Resistance yang telah ditembus secara valid berbalik peran menjadi lantai pijakan Support baru pada saat harga melakukan koreksi (retest).",
              },
            ],
          },
          {
            id: "l4-3",
            slug: "kuis-evaluasi-modul-1-snr",
            title: "Kuis Evaluasi Modul 1: Pemetaan Zona & Dinamika SBR/RBS",
            duration: "12 Menit",
            type: "quiz",
            summary: "Evaluasi wajib Modul 1 untuk menguji penguasaan teknik penarikan zona Body-to-Wick dan strategi Break-and-Retest (SBR/RBS).",
            learningObjectives: [
              "Menguji pemahaman perbedaan fundamental antara zona harga dan garis tunggal",
              "Menguji analisis mekanisme order di balik terbentuknya SBR dan RBS",
              "Mengevaluasi keakuratan penempatan Stop Loss dan titik eksekusi pada skenario retest",
            ],
            content: [
              "Kerjakan evaluasi Modul 1 ini untuk menguji pemahaman Anda tentang pemetaan zona Support/Resistance berbasis mikrostruktur serta strategi eksekusi pada skenario Role Reversal (SBR/RBS).",
              "Batas nilai kelulusan adalah minimal 70%.",
            ],
            applicationExample:
              "Memvalidasi kualitas zona RBS/SBR sebelum menempatkan modal pada fase retest pertama.",
            caseStudy:
              "Analisis skenario penembusan dan pengujian ulang level kunci pada timeframe H1 dan H4.",
            practicalSteps: [
              "Pilih jawaban yang paling tepat pada setiap soal di bawah ini.",
              "Kirim jawaban Anda untuk memverifikasi kelulusan di server.",
            ],
            commonMistakes: [
              "Mengejar harga di pucuk penembusan alih-alih menunggu koreksi ke zona flip.",
            ],
            keyTakeaways: [
              "Pemetaan zona yang akurat dan kesabaran menunggu First Retest adalah fondasi utama eksekusi level horizontal.",
              "Zona SBR dan RBS bekerja paling optimal di dalam pasar yang sedang ber-tren jelas.",
            ],
            quiz: [
              {
                id: "q4-3-1",
                question: "Mengapa trader profesional menggambar Support dan Resistance sebagai sebuah ZONA (area rentang harga), bukan satu garis tipis?",
                options: [
                  "Agar grafik terlihat lebih berwarna",
                  "Karena antrean order institusional tersebar dalam rentang harga dan kuotasi Bid/Ask bervariasi, sehingga reaksi pasar terjadi di dalam suatu area, bukan pada satu titik desimal eksak",
                  "Karena platform charting tidak menyediakan fitur garis lurus",
                  "Agar tidak perlu menggunakan Stop Loss",
                ],
                correctAnswer: 1,
                explanation:
                  "Akumulasi dan distribusi order berukuran besar selalu tersebar dalam suatu kisaran harga (zona), sehingga reaksi pantulan harga terjadi di dalam rentang tersebut.",
              },
              {
                id: "q4-3-2",
                question: "Ketika zona Support di 2630–2632 ditembus secara impulsif ke bawah hingga harga mencapai 2618, lalu harga memantul korektif naik kembali ke 2630–2632 dan membentuk Bearish Engulfing, skenario apakah yang sedang terjadi?",
                options: [
                  "Resistance Become Support (RBS)",
                  "Support Become Resistance (SBR) — lantai Support lama yang telah jebol kini beralih fungsi menjadi atap Resistance baru untuk kelanjutan tren turun",
                  "Bullish Breakout",
                  "Kegagalan pasar",
                ],
                correctAnswer: 1,
                explanation:
                  "Support yang telah ditembus tegas ke bawah berubah fungsi menjadi penghalang atas (Resistance) saat diuji kembali dari bawah (Support Become Resistance / SBR).",
              },
              {
                id: "q4-3-3",
                question: "Manakah kondisi pasar yang membuat skenario SBR/RBS menjadi TIDAK VALID dan sebaiknya dihindari?",
                options: [
                  "Zona ditembus oleh candle impulsif yang kuat lalu diuji kembali untuk pertama kalinya",
                  "Harga bergerak menyamping (sideways/choppy) dan sudah menembus zona tersebut bolak-balik berkali-kali tanpa arah tren yang jelas",
                  "Pengujian kembali (retest) disertai dengan konfirmasi Rejection Pinbar",
                  "Retest terjadi pada jam aktif sesi London atau New York",
                ],
                correctAnswer: 1,
                explanation:
                  "Zona yang ditembus bolak-balik di tengah pasar sideways menunjukkan bahwa zona tersebut sudah tidak lagi dihormati oleh antrean order besar (equilibrium noise).",
              },
            ],
          },
        ],
      },
      {
        id: "m4-2",
        title: "Modul 2: Zona Supply/Demand, Kesegaran Level & Kolam Likuiditas",
        description: "Membedakan zona segar (Fresh Zone) dari level yang sudah jenuh serta mengenali magnet likuiditas Equal Highs/Lows.",
        lessons: [
          {
            id: "l4-4",
            slug: "zona-supply-demand-dan-freshness",
            title: "Supply & Demand Zones: Konsep Zona Segar (Fresh/Unmitigated) vs Zona Jenuh",
            duration: "22 Menit",
            type: "reading",
            summary: "Memahami mengapa sentuhan pertama pada zona asal impuls (Fresh Zone) memiliki probabilitas pantulan tertinggi dibanding level yang sudah diuji berkali-kali.",
            learningObjectives: [
              "Membedakan zona Support/Resistance klasik dari zona Supply (Distribusi) dan Demand (Akumulasi) asal pergerakan impulsif",
              "Menjelaskan konsep Order Absorption: mengapa setiap kali sebuah zona disentuh, sisa antrean Limit Order di dalamnya semakin berkurang",
              "Mengidentifikasi empat anatomi dasar pembentukan zona: Rally-Base-Rally (RBR), Drop-Base-Drop (DBD), Drop-Base-Rally (DBR), dan Rally-Base-Drop (RBD)",
            ],
            content: [
              "Untuk meningkatkan presisi pemetaan level, kita perlu memahami konsep Supply (Penawaran/Distribusi) dan Demand (Permintaan/Akumulasi). Zona Demand adalah area konsolidasi singkat (Base) sebelum harga melesat naik secara eksplosif dan mencetak Break of Structure (BOS). Sebaliknya, Zona Supply adalah area konsolidasi singkat (Base) sebelum harga jatuh tajam secara impulsif dan mematahkan struktur bawah.",
              "Keberangkatan harga yang sangat cepat dan timpang dari sebuah Base membuktikan bahwa pada zona tersebut terdapat ketidakseimbangan order institusional yang sangat besar—begitu besarnya sehingga tidak semua antrean Limit Order milik institusi sempat terisi sebelum harga meninggalkan area tersebut. Oleh karena itu, ketika harga kembali mengunjungi zona tersebut untuk PERTAMA KALINYA (First Touch / Fresh Unmitigated Zone), sisa antrean Limit Order institusi yang masih menunggu di sana memiliki probabilitas tinggi untuk memantulkan harga.",
              "Di sinilah letak perbedaan krusial antara pola pikir ritel lama dan mikrostruktur modern: buku teks lama mengajarkan bahwa 'semakin sering sebuah Support diuji (4–5 kali pantulan), semakin kuat Support tersebut'. Secara mikrostruktur buku order, yang terjadi justru sebaliknya! Setiap kali harga menghantam sebuah zona Support, sebagian antrean Limit Buy di dalam zona tersebut terpakai (terserap). Pada sentuhan ke-3 atau ke-4, antrean Limit Buy di zona tersebut sudah semakin tipis (jenuh), sementara di bawah zona tersebut justru terkumpul ribuan Stop Loss yang siap disapu!",
              "Dengan demikian, prioritaskan selalu zona yang: (1) Menjadi titik keberangkatan candle impulsif yang mematahkan struktur (BOS), dan (2) Masih segar (Fresh / belum pernah disentuh kembali sejak terbentuk) atau baru diuji satu kali.",
            ],
            applicationExample:
              "Pada grafik H4 XAUUSD, harga berkonsolidasi dalam 2 candle kecil di 2632–2636 (Base), lalu tiba-tiba melesat 300 pips ke 2666 menembus Swing High sebelumnya. Zona 2632–2636 ditandai sebagai Fresh Demand Zone. Tiga hari kemudian, harga turun menyentuh 2635 untuk pertama kalinya dan langsung memantul 180 pips karena sisa antrean Limit Buy institusional di zona tersebut terpicu.",
            caseStudy:
              "Sebuah level Support di 2650 sudah diuji sebanyak 4 kali dalam dua hari terakhir, dan setiap pantulan menghasilkan kenaikan yang semakin lemah (dari 120 pips menjadi 70 pips, lalu 30 pips). Pada sentuhan ke-5, level 2650 langsung jebol ke bawah karena seluruh antrean Limit Buy di 2650 telah habis diserap pada empat pengujian sebelumnya.",
            practicalSteps: [
              "Cari pergerakan impulsif tajam pada grafik H1/H4 yang berhasil mencetak BOS, lalu telusuri mundur ke titik awal keberangkatannya untuk menemukan candle Base terakhir.",
              "Tandai candle Base tersebut sebagai Zona Supply (jika mendahului penurunan tajam) atau Zona Demand (jika mendahului kenaikan tajam).",
              "Beri prioritas utama pada zona yang belum pernah tersentuh kembali sejak impuls tersebut terjadi (Fresh Zone).",
            ],
            commonMistakes: [
              "Terus membeli pada zona Support yang sama untuk ke-4 atau ke-5 kalinya meskipun pantulan sebelumnya semakin melemah.",
              "Menandai area konsolidasi panjang yang diikuti pergerakan lambat dan lemah sebagai zona Supply/Demand.",
              "Melupakan bahwa Zona Demand di dalam tren turun besar (Bearish HTF) memiliki peluang bertahan yang jauh lebih rendah dibanding Zona Supply searah tren.",
            ],
            keyTakeaways: [
              "Zona Supply dan Demand terbaik lahir dari ketidakseimbangan order yang memicu pergerakan impulsif dan Break of Structure.",
              "Sentuhan pertama (Fresh / Unmitigated Zone) menawarkan probabilitas reaksi terbaik karena antrean order pasif di dalamnya belum terkuras.",
              "Pantulan yang semakin melemah pada level yang diuji berulang kali adalah tanda menipisnya antrean order pertahanan.",
            ],
            quiz: [
              {
                id: "q4-4-inline-1",
                question: "Mengapa sebuah zona Demand yang baru diuji untuk pertama kalinya (Fresh Zone) memiliki probabilitas bertahan lebih baik dibandingkan level Support yang sudah diuji 4–5 kali?",
                options: [
                  "Karena pada Fresh Zone antrean Limit Buy institusional yang belum terisi masih utuh, sedangkan pada level yang diuji berulang kali antrean belinya semakin terkuras habis dan menumpuk Stop Loss di bawahnya",
                  "Karena indikator selalu berubah warna pada sentuhan pertama",
                  "Karena level yang sudah diuji 5 kali tidak pernah bisa ditembus",
                  "Karena broker memberikan spread diskon pada Fresh Zone",
                ],
                correctAnswer: 0,
                explanation:
                  "Setiap pengujian ulang terhadap suatu zona mengonsumsi sebagian Limit Order yang ada di dalamnya. Zona yang masih segar (Fresh) menyimpan sisa antrean order awal yang paling tebal.",
              },
            ],
          },
          {
            id: "l4-5",
            slug: "equal-highs-lows-dan-kolam-likuiditas",
            title: "Kolam Likuiditas di Balik Level: Equal Highs (EQH), Equal Lows (EQL) & Sweep Confirmation",
            duration: "20 Menit",
            type: "chart-study",
            summary: "Mengenali mengapa formasi puncak kembar (Double Top / EQH) dan lembah kembar (Double Bottom / EQL) sering menjadi magnet sapuan Stop Loss sebelum harga bergerak ke arah sebenarnya.",
            learningObjectives: [
              "Mengidentifikasi formasi Equal Highs (EQH) sebagai kolam Buy-Side Liquidity dan Equal Lows (EQL) sebagai kolam Sell-Side Liquidity",
              "Menjelaskan cara mengubah jebakan sapuan EQH/EQL menjadi peluang eksekusi probabilitas tinggi (Sweep & Reclaim)",
              "Menetapkan target Take Profit yang logis menggunakan kolam likuiditas EQH/EQL terdekat",
            ],
            content: [
              "Ketika harga membentuk dua atau tiga puncak pada ketinggian yang hampir sama persis (Double Top / Triple Top / Equal Highs — EQH), atau dua lembah pada kedalaman yang hampir sejajar (Double Bottom / Equal Lows — EQL), buku teks ritel langsung menyebutnya sebagai 'pertahanan beton yang sangat kuat'. Akibatnya, ribuan trader ritel kompak menempatkan Stop Loss tepat beberapa pips di atas Equal Highs atau tepat di bawah Equal Lows tersebut.",
              "Dalam kacamata likuiditas institusional, barisan puncak atau lembah yang terlalu rapi dan sejajar bukanlah benteng pertahanan, melainkan KOLAM LIKUIDITAS (Liquidity Pool / Money Magnet). Di atas Equal Highs terdapat tumpukan Buy Stop (Buy-Side Liquidity), dan di bawah Equal Lows terdapat tumpukan Sell Stop (Sell-Side Liquidity).",
              "Karena pasar selalu bergerak menuju area yang memiliki konsentrasi order tertinggi, level Equal Highs dan Equal Lows sangat sering disapu terlebih dahulu (Liquidity Sweep) sebelum harga berbalik arah, atau dijadikan bahan bakar percepatan apabila penembusan tersebut searah dengan tren utama.",
              "Bagaimana cara profesional memanfaatkan EQH dan EQL? Ada dua cara: (1) Saat Anda sedang berada di luar pasar, JANGAN menaruh antrean Limit Order tepat di garis EQL/EQH, melainkan tunggu apakah terjadi sapuan sumbu (Sweep) di luar EQL/EQH yang diikuti penutupan candle kembali ke dalam rentang (Reclaim), dan (2) Saat Anda sudah memiliki posisi terbuka dari zona diskon, gunakan level EQH di atas sebagai target Take Profit yang sangat objektif karena harga cenderung tertarik menyapu kolam likuiditas tersebut!",
            ],
            applicationExample:
              "Pada grafik H1 XAUUSD, terdapat dua lembah sejajar (Equal Lows) di 2640.00, dan tepat di bawahnya pada 2635.00–2637.00 terdapat Fresh Demand Zone. Trader tidak memasang Buy Limit di 2640.00. Benar saja, harga turun menyapu 2640.00 (memicu Stop Loss ritel), menyentuh Fresh Demand di 2636.00, lalu menutup candle H1 kembali di 2642.00. Trader masuk Buy setelah sapuan selesai dan menargetkan Equal Highs di 2668.00 sebagai lokasi Take Profit.",
            caseStudy:
              "Studi kasus XAUUSD H1: Tumpukan tiga puncak sejajar (Equal Highs) di 2675.00 menjadi magnet penarik harga dari 2650.00. Trader yang memahami konsep Liquidity Pool menahan posisi Buy-nya hingga menyentuh 2675.50 karena mengetahui pasar memiliki dorongan kuat untuk menyapu likuiditas di atas puncak kembar tersebut.",
            chartData: {
              title: "Sapuan Equal Lows (EQL Sweep) ke Zona Demand & Target Equal Highs",
              description: "Harga menyapu kumpulan Stop Loss di bawah Equal Lows menuju Fresh Demand Zone, mencetak Rejection & Reclaim, lalu berekspansi menyapu Equal Highs di atasnya.",
              timeframe: "H1",
              bias: "Bullish",
            },
            practicalSteps: [
              "Tandai setiap formasi dua puncak atau dua lembah yang sejajar rapi pada grafik H1/H4 dengan label 'EQH / BSL' (Buy-Side Liquidity) atau 'EQL / SSL' (Sell-Side Liquidity).",
              "Periksa apakah tepat di balik EQH/EQL tersebut terdapat Zona Supply atau Demand segar yang belum teruji.",
              "Gunakan level EQH/EQL searah tren sebagai target Take Profit utama Anda, dan hindari menaruh Stop Loss tepat di balik EQH/EQL.",
            ],
            commonMistakes: [
              "Menempatkan Stop Loss tepat 2–3 pips di bawah Double Bottom (Equal Lows) yang sangat mencolok.",
              "Masuk posisi terlalu cepat di level Equal Highs/Lows sebelum sapuan likuiditas menuju zona Fresh di baliknya selesai.",
              "Menutup posisi profit terlalu dini padahal tepat 15 pips di atasnya terdapat target magnet Equal Highs yang jelas.",
            ],
            keyTakeaways: [
              "Equal Highs (EQH) dan Equal Lows (EQL) adalah magnet likuiditas tempat berkumpulnya Stop Loss dan Breakout Order.",
              "Jangan jadikan EQH/EQL sebagai tempat menaruh Stop Loss; jadikan EQH/EQL sebagai target Take Profit atau tunggu konfirmasi Sweep & Reclaim.",
              "Kombinasi paling kuat adalah sapuan terhadap EQH/EQL yang langsung menusuk ke dalam Fresh Supply/Demand Zone di baliknya.",
            ],
            quiz: [
              {
                id: "q4-5-inline-1",
                question: "Mengapa formasi Equal Lows (dua atau tiga lembah yang sejajar rapi) sering ditembus sementara oleh sumbu bawah sebelum harga benar-benar naik?",
                options: [
                  "Karena grafik mengalami gangguan koneksi internet",
                  "Karena di bawah Equal Lows terkumpul banyak order Sell Stop (Stop Loss pembeli ritel) yang menjadi kolam likuiditas bagi institusi untuk mengisi posisi Buy mereka di harga diskon",
                  "Karena Equal Lows tidak pernah terlihat oleh trader institusi",
                  "Karena semua trader dilarang membeli di dekat Support",
                ],
                correctAnswer: 1,
                explanation:
                  "Lembah kembar yang rapi memancing penempatan Stop Loss massal tepat di bawahnya. Institusi menyapu kolam Sell-Side Liquidity tersebut untuk menyerap order jual sebelum mendorong harga naik.",
              },
            ],
          },
          {
            id: "l4-6",
            slug: "final-assessment-support-and-resistance",
            title: "Final Assessment: Ujian Komprehensif Support & Resistance Dinamis",
            duration: "15 Menit",
            type: "quiz",
            summary: "Ujian akhir kelulusan kelas SC-04 Support & Resistance Dinamis (Batas kelulusan: 70%).",
            learningObjectives: [
              "Menguji penguasaan terpadu atas pemetaan Zona Body-to-Wick, SBR/RBS, Supply/Demand, kesegaran zona, dan Liquidity Pool (EQH/EQL)",
              "Memverifikasi kemampuan siswa menyusun skenario level horizontal yang presisi sebelum naik ke kelas Technical Analysis Framework",
            ],
            content: [
              "Selamat datang di Final Assessment kelas SC-04: Support & Resistance Dinamis. Evaluasi akhir ini menguji kemampuan Anda membedakan zona segar dari level jenuh, mengeksekusi skenario Role Reversal (SBR/RBS), serta membaca dinamika kolam likuiditas di balik level kunci.",
              "Jawab seluruh soal dengan teliti. Skor minimal 70% diperlukan untuk menyelesaikan kelas ini dan membuka Sertifikat Kelulusan.",
            ],
            applicationExample:
              "Mengombinasikan struktur tren H4, pemetaan Fresh Demand / RBS Zone, dan identifikasi target likuiditas Equal Highs dalam satu rencana transaksi utuh.",
            caseStudy:
              "Evaluasi komprehensif berbagai skenario reaksi harga terhadap zona Support, Resistance, dan kolam likuiditas.",
            practicalSteps: [
              "Analisis setiap pertanyaan dengan memadukan konsep zona dan likuiditas buku order.",
              "Kirim jawaban Anda ke server untuk penilaian akhir kelas SC-04.",
            ],
            commonMistakes: [
              "Menempatkan Stop Loss tepat di area kolam likuiditas Equal Highs/Lows.",
            ],
            keyTakeaways: [
              "Pemahaman mendalam atas zona reaksi dan likuiditas level melengkapi fondasi teknikal murni Anda sebelum menyusun sistem trading utuh di SC-05.",
              "Zona segar (Fresh Zone) di balik kolam likuiditas Equal Highs/Lows memberikan area reaksi paling objektif.",
            ],
            quiz: [
              {
                id: "q4-6-1",
                question: "Urutan prioritas kualitas zona manakah yang memiliki probabilitas paling tinggi untuk menghasilkan pantulan searah tren?",
                options: [
                  "Zona Support yang sudah diuji 6 kali berturut-turut dengan pantulan yang semakin lemah",
                  "Zona Demand segar (Fresh / Unmitigated) di area Discount yang merupakan titik awal keberangkatan candle impulsif pencetak Break of Structure (BOS)",
                  "Garis horizontal acak yang ditarik di tengah-tengah candle tanpa sumbu",
                  "Zona Resistance di dalam tren naik yang sudah ditembus ke atas",
                ],
                correctAnswer: 1,
                explanation:
                  "Zona Demand yang masih segar (Fresh), berada di area Discount, dan terbukti menjadi pemicu BOS menyimpan ketidakseimbangan order institusional yang paling kuat.",
              },
              {
                id: "q4-6-2",
                question: "Jika Anda sedang memegang posisi Buy dari bawah dalam tren naik yang sehat, mengapa level Equal Highs (Double Top) di atas harga saat ini sangat ideal dijadikan target Take Profit?",
                options: [
                  "Karena harga tidak mungkin menyentuh Equal Highs",
                  "Karena di atas Equal Highs terkumpul kolam likuiditas (Buy-Side Liquidity / Stop Loss penjual) yang cenderung menarik harga untuk menyapunya",
                  "Karena broker mewajibkan penutupan posisi di Double Top",
                  "Karena spread menjadi nol di Equal Highs",
                ],
                correctAnswer: 1,
                explanation:
                  "Tumpukan order di atas Equal Highs bertindak sebagai magnet likuiditas, menjadikannya sasaran objektif yang berprobabilitas tinggi untuk dicapai oleh harga.",
              },
              {
                id: "q4-6-3",
                question: "Apa langkah paling bijaksana apabila tepat di atas sebuah Zona Demand yang masih segar terdapat formasi Equal Lows (lembah kembar sejajar)?",
                options: [
                  "Menaruh Stop Loss tepat di garis Equal Lows",
                  "Menunggu dengan sabar hingga harga menyapu likuiditas di bawah Equal Lows dan masuk menyentuh Zona Demand segar di bawahnya, lalu mencari konfirmasi penolakan untuk Buy",
                  "Langsung melakukan Market Sell tepat di atas Zona Demand",
                  "Mengabaikan keberadaan Zona Demand tersebut",
                ],
                correctAnswer: 1,
                explanation:
                  "Dalam konfigurasi ini, Equal Lows berfungsi sebagai Inducement / kolam likuiditas yang akan disapu untuk mengantarkan harga masuk ke dalam Zona Demand segar di bawahnya.",
              },
              {
                id: "q4-6-4",
                question: "Bagaimana syarat validasi eksekusi pada skenario Support Become Resistance (SBR) dalam tren turun?",
                options: [
                  "Langsung Sell saat harga masih berada jauh di atas Support",
                  "Tunggu hingga zona Support ditembus tegas ke bawah oleh penutupan candle impulsif, lalu tunggu harga memantul korektif menguji kembali bekas zona Support tersebut (kini SBR) dan memunculkan konfirmasi penolakan jual",
                  "Langsung Buy saat Support ditembus ke bawah",
                  "Menarik garis secara vertikal pada grafik",
                ],
                correctAnswer: 1,
                explanation:
                  "SBR yang valid mensyaratkan penembusan tegas terhadap Support terlebih dahulu, diikuti koreksi naik (retest) ke zona tersebut yang terkonfirmasi gagal menembus balik ke atas.",
              },
            ],
          },
        ],
      },
    ],
  },
];
