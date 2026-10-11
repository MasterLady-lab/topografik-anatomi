
/* ==========================================
   TOPOGRAFİK ANATOMİ
   LABORATUVAR KİTAP OKUYUCU
   PDF.js + StPageFlip
========================================== */

const reader = document.getElementById("book-reader");
let flipbookAlani = document.getElementById("flipbook-animation");
const normalKitap = document.getElementById("flipbook");

const closeButton = document.getElementById("reader-close");
const oncekiButton = document.getElementById("reader-prev");
const sonrakiButton = document.getElementById("reader-next");
const buyutButton = document.getElementById("reader-zoom-in");
const kucultButton = document.getElementById("reader-zoom-out");

const zoomYazisi = document.getElementById("reader-zoom-level");
const sayfaYazisi = document.getElementById("reader-page-number");

const books = document.querySelectorAll(".book");

/* ==========================================
   LABORATUVAR PDF DOSYALARI
========================================== */

const kitapDosyalari = {
    "1": "pdfs/lab1.pdf",
    "2": "pdfs/lab2.pdf",
    "3": "pdfs/lab3.pdf",
    "4-5": "pdfs/lab4-5.pdf",
    "6": "pdfs/lab6.pdf",
    "7": "pdfs/lab7.pdf",
    "8": "pdfs/lab8.pdf",
    "9": "pdfs/lab9.pdf",
    "12": "pdfs/lab12.pdf",
    "13": "pdfs/lab13.pdf"
};

/* ==========================================
   OKUYUCU DEĞİŞKENLERİ
========================================== */

let aktifKitap = null;
let aktifPDF = null;
let sayfaCevirici = null;

let toplamSayfa = 0;
let yakinlastirma = 1;

let kitapYukleniyor = false;

// Her kitabın kaldığı sayfayı ayrı tutar.
const kitapKonumlari = {};

// PDF belgelerini tekrar indirmemek için önbellek.
const pdfOnbellek = {};

/* ==========================================
   KÜTÜPHANE KONTROLÜ
========================================== */

if (typeof pdfjsLib === "undefined") {
    console.error("PDF.js kütüphanesi yüklenemedi!");
}

if (
    typeof St === "undefined" ||
    typeof St.PageFlip !== "function"
) {
    console.error("StPageFlip kütüphanesi yüklenemedi!");
}

/* ==========================================
   KİTAP NUMARASINI BUL
========================================== */

function kitapNumarasiniBul(kitap) {
    const numaraAlani = kitap.querySelector(".book-number");

    if (!numaraAlani) {
        return null;
    }

    const metin = numaraAlani.textContent
        .replace("LAB", "")
        .trim()
        .replace(/[–—]/g, "-")
        .replace(/\s+/g, "");

    return metin;
}

/* ==========================================
   SAYFA NUMARASI GÖSTER
========================================== */

function sayfaNumarasiniGuncelle(indeks = 0) {
    if (!toplamSayfa) {
        sayfaYazisi.textContent = "0 / 0";
        return;
    }

    const guvenliIndeks = Math.max(
        0,
        Math.min(indeks, toplamSayfa - 1)
    );

    const ilkSayfa =
        Math.floor(guvenliIndeks / 2) * 2 + 1;

    const sonSayfa = Math.min(
        ilkSayfa + 1,
        toplamSayfa
    );

    sayfaYazisi.textContent =
        `${ilkSayfa}–${sonSayfa} / ${toplamSayfa}`;
}

/* ==========================================
   ZOOM KONTROLÜ
========================================== */

function zoomGuncelle() {
    zoomYazisi.textContent =
        Math.round(yakinlastirma * 100) + "%";

    flipbookAlani.style.zoom = yakinlastirma;
}

buyutButton.addEventListener("click", function () {
    yakinlastirma = Math.min(
        3,
        yakinlastirma + 0.25
    );

    zoomGuncelle();
});

kucultButton.addEventListener("click", function () {
    yakinlastirma = Math.max(
        0.5,
        yakinlastirma - 0.25
    );

    zoomGuncelle();
});

/* ==========================================
   PDF SAYFASI OLUŞTUR
========================================== */

function kitapSayfasiOlustur() {
    const sayfa = document.createElement("div");
    sayfa.className = "page";

    const kagit = document.createElement("div");
    kagit.className = "page-content";

    const canvas = document.createElement("canvas");
    canvas.className = "flip-page-canvas";

    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";

    kagit.appendChild(canvas);
    sayfa.appendChild(kagit);

    return sayfa;
}

/* ==========================================
   PDF SAYFASINI CANVAS'A ÇİZ
========================================== */


async function animasyonSayfasiCiz(sayfaNumarasi, canvas, pdf) {
    const pdfSayfasi = await pdf.getPage(sayfaNumarasi);
    const context = canvas.getContext("2d");

    const orijinal = pdfSayfasi.getViewport({ scale: 1 });

    // PDF'nin kendi en-boy oranını koru.
    const olcek = Math.min(
        760 / orijinal.width,
        1070 / orijinal.height
    );

    const viewport = pdfSayfasi.getViewport({ scale: olcek });

  
// PDF'yi yüksek çözünürlükte çiz.
const pixelOrani = Math.min(
    window.devicePixelRatio || 1,
    2
);

canvas.width = Math.round(
    viewport.width * pixelOrani
);

canvas.height = Math.round(
    viewport.height * pixelOrani
);

canvas.style.width = "100%";
canvas.style.height = "100%";

await pdfSayfasi.render({
    canvasContext: context,
    viewport: viewport,
    transform: [
        pixelOrani, 0,
        0, pixelOrani,
        0, 0
    ]
}).promise;


    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.objectFit = "contain";

    await pdfSayfasi.render({
        canvasContext: context,
        viewport: viewport
    }).promise;
}


/* ==========================================
   TÜM PDF SAYFALARINI HAZIRLA
========================================== */


async function animasyonSayfalariniHazirla(pdf) {
    flipbookAlani.innerHTML = "";

    // Önce bütün sayfaların boş şablonlarını oluştur.
    // Böylece kitap açılırken 35 sayfayı beklemeyiz.
    for (let numara = 1; numara <= pdf.numPages; numara++) {
        const sayfa = kitapSayfasiOlustur();

        sayfa.dataset.sayfa = numara;
        flipbookAlani.appendChild(sayfa);
    }

    // Başlangıçta yalnızca ilk dört sayfayı çiz.
    const ilkSayfalar = Math.min(4, pdf.numPages);

    await Promise.all(
        Array.from({ length: ilkSayfalar }, (_, i) => {
            const sayfa = flipbookAlani.querySelectorAll(".page")[i];
            return animasyonSayfasiCiz(
                i + 1,
                sayfa.querySelector("canvas"),
                pdf
            );
        })
    );
}


/* ==========================================
   SAYFA ÇEVİRME MOTORUNU OLUŞTUR
========================================== */

async function animasyonluKitabiBaslat(
    pdf,
    kitapNumarasi
) {
    await animasyonSayfalariniHazirla(pdf);

    const sayfalar =
        flipbookAlani.querySelectorAll(".page");

    const kayitliIndeks =
        kitapKonumlari[kitapNumarasi] || 0;

    sayfaCevirici = new St.PageFlip(
        flipbookAlani,
        {
            width: 380,
            height: 535,

            size: "stretch",

            minWidth: 180,
            maxWidth: 380,

            minHeight: 350,
            maxHeight: 535,

            showCover: false,
            usePortrait: true,

            startPage: kayitliIndeks,

            flippingTime: 800,
            drawShadow: true
        }
    );

    sayfaCevirici.loadFromHTML(sayfalar);

    sayfaNumarasiniGuncelle(kayitliIndeks);

    // Sayfa çevrildiğinde konumu kaydet.
    
const cizilenSayfalar = new Set([1, 2, 3, 4]);
const cizimIslemleri = new Map();

async function sayfayiYukle(numara) {
    if (numara < 1 || numara > pdf.numPages) return;
    if (cizilenSayfalar.has(numara)) return;

    if (cizimIslemleri.has(numara)) {
        return cizimIslemleri.get(numara);
    }

    const islem = (async () => {
        const sayfa = sayfalar[numara - 1];
        if (!sayfa) return;

        await animasyonSayfasiCiz(
            numara,
            sayfa.querySelector("canvas"),
            pdf
        );

        cizilenSayfalar.add(numara);
    })();

    cizimIslemleri.set(numara, islem);

    try {
        await islem;
    } finally {
        cizimIslemleri.delete(numara);
    }
}

sayfaCevirici.on("flip", function (olay) {
    const indeks = olay.data;

    kitapKonumlari[kitapNumarasi] = indeks;
    sayfaNumarasiniGuncelle(indeks);

    // Açık sayfaları ve sonraki sayfaları hazırla.
    for (let i = indeks + 1; i <= indeks + 6; i++) {
        sayfayiYukle(i).catch(console.error);
    }
});

}

/* ==========================================
   KİTAP AÇ
========================================== */

async function kitapAc(kitapNumarasi) {
    if (kitapYukleniyor) {
        return;
    }

    const dosyaYolu = kitapDosyalari[kitapNumarasi];

    if (!dosyaYolu) {
        alert(
            "Bu laboratuvar için PDF tanımlanmamış."
        );
        return;
    }

    // Aynı kitap yeniden açılıyorsa
    // kaldığı yerden devam et.
    if (
        aktifKitap === kitapNumarasi &&
        sayfaCevirici
    ) {
        reader.hidden = false;

        normalKitap.style.display = "none";
        flipbookAlani.hidden = false;
        flipbookAlani.style.visibility = "visible";

        sayfaCevirici.update();

        return;
    }

    kitapYukleniyor = true;

    reader.hidden = false;

    normalKitap.style.display = "none";
    flipbookAlani.hidden = false;

    // Büyükten küçüğe sıçrama görünmesin.
    flipbookAlani.style.visibility = "hidden";

    oncekiButton.disabled = true;
    sonrakiButton.disabled = true;

    try {
        // Önceki kitabın son konumunu kaydet.
        if (sayfaCevirici && aktifKitap) {
            kitapKonumlari[aktifKitap] =
                sayfaCevirici.getCurrentPageIndex();

            sayfaCevirici.destroy();
            sayfaCevirici = null;
            


const eskiAlan = document.getElementById("flipbook-animation");

const yeniAlan = document.createElement("div");
yeniAlan.id = "flipbook-animation";

// Eski alan hâlâ mevcutsa değiştir.
if (eskiAlan) {
    eskiAlan.replaceWith(yeniAlan);
} else {
    // StPageFlip eski alanı kaldırmışsa yeniden oluştur.
    document.getElementById("reader-pages")
        .appendChild(yeniAlan);
}

flipbookAlani = yeniAlan;



flipbookAlani.style.visibility = "hidden";
flipbookAlani.style.zoom = "1";

yakinlastirma = 1;
zoomGuncelle();

        }

        aktifKitap = null;

        let pdf = pdfOnbellek[kitapNumarasi];

        if (!pdf) {
            pdf = await pdfjsLib.getDocument(
                dosyaYolu
            ).promise;

            pdfOnbellek[kitapNumarasi] = pdf;
        }

        aktifPDF = pdf;
        toplamSayfa = pdf.numPages;

        await animasyonluKitabiBaslat(
            pdf,
            kitapNumarasi
        );

        aktifKitap = kitapNumarasi;

        // Tarayıcı yerleşimi tamamlasın.
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                if (!reader.hidden) {
                    flipbookAlani.style.visibility =
                        "visible";
                }
            });
        });

    } catch (hata) {
        console.error(
            "Kitap açılırken hata oluştu:",
            hata
        );

        flipbookAlani.style.visibility = "visible";

        alert(
            "Kitap açılamadı.\n\n" +
            "PDF dosyasını kontrol et:\n" +
            dosyaYolu
        );

        reader.hidden = true;

    } finally {
        kitapYukleniyor = false;

        oncekiButton.disabled = false;
        sonrakiButton.disabled = false;
    }
}

/* ==========================================
   KİTAP KAPAKLARINA TIKLAMA
========================================== */

books.forEach(function (kitap) {
    const kitapNumarasi =
        kitapNumarasiniBul(kitap);

    kitap.addEventListener("click", function () {
        kitapAc(kitapNumarasi);
    });
});

/* ==========================================
   OKUYUCUYU KAPAT
========================================== */

closeButton.addEventListener("click", function () {
    // Motoru yok etmiyoruz.
    // Aynı kitap açılınca kaldığı yerden
    // devam edebilsin.

    if (sayfaCevirici && aktifKitap) {
        kitapKonumlari[aktifKitap] =
            sayfaCevirici.getCurrentPageIndex();
    }

    reader.hidden = true;
});

/* ==========================================
   ÖNCEKİ SAYFA
========================================== */

oncekiButton.addEventListener("click", function () {
    if (sayfaCevirici) {
        sayfaCevirici.flipPrev();
    }
});

/* ==========================================
   SONRAKİ SAYFA
========================================== */

sonrakiButton.addEventListener("click", function () {
    if (sayfaCevirici) {
        sayfaCevirici.flipNext();
    }
});

/* ==========================================
   KLAVYE KONTROLLERİ
========================================== */

document.addEventListener("keydown", function (olay) {
    if (reader.hidden || !sayfaCevirici) {
        return;
    }

    if (olay.key === "ArrowRight") {
        sayfaCevirici.flipNext();
    }

    if (olay.key === "ArrowLeft") {
        sayfaCevirici.flipPrev();
    }

    if (olay.key === "Escape") {
        reader.hidden = true;
    }
});

/* ==========================================
   BAŞLANGIÇ
========================================== */

normalKitap.style.display = "none";
flipbookAlani.hidden = true;

zoomGuncelle();

console.log(
    "📖 Topografik Anatomi kitap okuyucusu hazır!"
);
