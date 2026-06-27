"""
TEFAS Yabancı Fon Verisi Çekici
GitHub Actions tarafından günlük çalıştırılır.
Tüm Yabancı fonların 1 yıllık fiyat geçmişini çeker ve data/ klasörüne kaydeder.
"""

import requests
import json
import os
import time
import math
from datetime import datetime, timedelta

# Yabancı statüsündeki fonların listesi
FUNDS = [
    {"code": "AES", "name": "AK PORTFÖY PETROL YABANCI BYF FON SEPETİ FONU",         "short": "Petrol BYF"},
    {"code": "AFA", "name": "AK PORTFÖY AMERİKA YABANCI HİSSE SENEDİ FONU",           "short": "Amerika Hisse"},
    {"code": "AFS", "name": "AK PORTFÖY SAĞLIK SEKTÖRÜ YABANCI HİSSE SENEDİ FONU",   "short": "Sağlık Hisse"},
    {"code": "AFT", "name": "AK PORTFÖY YENİ TEKNOLOJİLER YABANCI HİSSE SENEDİ FONU","short": "Teknoloji Hisse"},
    {"code": "AFV", "name": "AK PORTFÖY AVRUPA YABANCI HİSSE SENEDİ FONU",            "short": "Avrupa Hisse"},
    {"code": "AOY", "name": "AK PORTFÖY ALTERNATİF ENERJİ YABANCI HİSSE SENEDİ FONU","short": "Alternatif Enerji"},
    {"code": "ARE", "name": "İSTANBUL PORTFÖY YABANCI HİSSE SENEDİ FONU",             "short": "İstanbul Yabancı"},
    {"code": "GBC", "name": "AZİMUT PORTFÖY YABANCI HİSSE SENEDİ FONU",               "short": "Azimut Yabancı"},
    {"code": "GBG", "name": "INVEO PORTFÖY G-20 ÜLKELERİ YABANCI HİSSE SENEDİ FONU","short": "G-20 Hisse"},
    {"code": "GUH", "name": "GARANTİ PORTFÖY YABANCI TEKNOLOJİ HİSSE SENEDİ FONU",   "short": "Garanti Teknoloji"},
    {"code": "HOY", "name": "HSBC PORTFÖY YABANCI BYF FON SEPETI",                    "short": "HSBC BYF Sepet"},
    {"code": "KJK", "name": "KUVEYT TÜRK PORTFÖY YABANCI KATILIM SERBEST ÖZEL FON",   "short": "Kuveyt Türk Katılım"},
    {"code": "TDG", "name": "İŞ PORTFÖY YABANCI BORÇLANMA ARAÇLARI FONU",             "short": "İş Borçlanma"},
    {"code": "TFF", "name": "TEB PORTFÖY AMERİKA TEKNOLOJİ YABANCI BYF FON SEPETİ FONU","short": "TEB Amerika Teknoloji"},
    {"code": "TGE", "name": "İŞ PORTFÖY EMTİA YABANCI BYF FON SEPETİ FONU",           "short": "İş Emtia BYF"},
    {"code": "TLE", "name": "AURA PORTFÖY YABANCI BORÇLANMA ARAÇLARI FONU",            "short": "Aura Borçlanma"},
    {"code": "TMG", "name": "İŞ PORTFÖY YABANCI HİSSE SENEDİ FONU",                   "short": "İş Yabancı Hisse"},
    {"code": "YAY", "name": "YAPI KREDİ PORTFÖY YABANCI TEKNOLOJİ SEKTÖRÜ HİSSE SENEDİ FONU","short": "YKB Teknoloji"},
    {"code": "YTD", "name": "YAPI KREDİ PORTFÖY YABANCI FON SEPETİ FONU",             "short": "YKB Fon Sepeti"},
    {"code": "ZSF", "name": "ZİRAAT PORTFÖY S&P/OIC COMCEC 50 SHARİAH YABANCI HİSSE SENEDİ FONU","short": "Ziraat Shariah"},
]

TEFAS_URL = "https://www.tefas.gov.tr/api/DB/BindHistoryInfo"

HEADERS = {
    "Content-Type": "application/x-www-form-urlencoded",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": "https://www.tefas.gov.tr/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Origin": "https://www.tefas.gov.tr",
}

def get_session():
    """WAF bypass: önce ana sayfayı ziyaret et, cookie al."""
    session = requests.Session()
    try:
        session.get("https://www.tefas.gov.tr/", headers={
            "User-Agent": HEADERS["User-Agent"]
        }, timeout=30)
        time.sleep(2)
    except Exception as e:
        print(f"  Uyarı: Ana sayfa ziyareti başarısız: {e}")
    return session


def fetch_fund_history(session, fund_code, start_date, end_date):
    """Belirli bir fon için tarih aralığındaki fiyat verilerini çeker."""
    params = {
        "fontip": "YAT",
        "fonkod": fund_code,
        "bastarih": start_date.strftime("%d.%m.%Y"),
        "bittarih": end_date.strftime("%d.%m.%Y"),
    }

    try:
        resp = session.post(TEFAS_URL, data=params, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"  Hata ({fund_code}): {e}")
        return None


def calc_volatility(prices):
    """Günlük getiri standart sapmasını hesaplar (yıllık, %)."""
    if len(prices) < 2:
        return 0
    daily_returns = [
        (prices[i] - prices[i-1]) / prices[i-1]
        for i in range(1, len(prices))
        if prices[i-1] > 0
    ]
    if not daily_returns:
        return 0
    mean = sum(daily_returns) / len(daily_returns)
    variance = sum((r - mean) ** 2 for r in daily_returns) / len(daily_returns)
    daily_std = math.sqrt(variance)
    return daily_std * math.sqrt(252) * 100  # yıllık volatilite (%)


def calc_difficulty(volatility):
    if volatility < 10:
        return "Easy"
    elif volatility < 20:
        return "Medium"
    elif volatility < 35:
        return "Hard"
    else:
        return "Insane"


def main():
    end_date = datetime.today()
    start_date = end_date - timedelta(days=365)

    os.makedirs("data", exist_ok=True)

    session = get_session()

    funds_meta = []

    for fund in FUNDS:
        code = fund["code"]
        print(f"Çekiliyor: {code} - {fund['short']}...")

        raw = fetch_fund_history(session, code, start_date, end_date)

        if not raw or "data" not in raw or not raw["data"]:
            print(f"  Veri yok, atlanıyor.")
            funds_meta.append({**fund, "return1y": None, "volatility": None,
                                "difficulty": fund.get("difficulty", "Medium"),
                                "lastPrice": None, "lastDate": None})
            continue

        # TEFAS verisi ters sıralı gelebilir, tarihe göre sırala
        records = sorted(raw["data"], key=lambda r: datetime.strptime(r["TARIH"], "%d.%m.%Y"))

        prices_list = [
            {"date": r["TARIH"], "price": float(r["FIYAT"])}
            for r in records
            if r.get("FIYAT") is not None
        ]

        if not prices_list:
            print(f"  Fiyat verisi yok, atlanıyor.")
            continue

        price_values = [p["price"] for p in prices_list]
        first_price = price_values[0]
        last_price  = price_values[-1]
        return1y = round((last_price - first_price) / first_price * 100, 2) if first_price > 0 else None
        volatility = round(calc_volatility(price_values), 2)
        difficulty = calc_difficulty(volatility)

        # Her fon için ayrı JSON kaydet
        fund_data = {
            "code": code,
            "name": fund["name"],
            "short": fund["short"],
            "prices": prices_list,
        }
        with open(f"data/{code}.json", "w", encoding="utf-8") as f:
            json.dump(fund_data, f, ensure_ascii=False, separators=(",", ":"))

        print(f"  OK: {len(prices_list)} gün, {return1y:+.1f}%, volatilite {volatility:.1f}% → {difficulty}")

        funds_meta.append({
            "code": code,
            "name": fund["name"],
            "short": fund["short"],
            "return1y": return1y,
            "volatility": volatility,
            "difficulty": difficulty,
            "lastPrice": last_price,
            "lastDate": prices_list[-1]["date"],
        })

        # Rate limit: dakikada 6 istek
        time.sleep(11)

    # Ana metadata JSON'u kaydet
    meta = {
        "updated": datetime.today().strftime("%d.%m.%Y %H:%M"),
        "funds": funds_meta,
    }
    with open("data/funds.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"\nTamamlandı. {len(funds_meta)} fon işlendi.")


if __name__ == "__main__":
    main()
