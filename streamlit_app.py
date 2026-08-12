from __future__ import annotations

from io import BytesIO
import re

import pandas as pd
import requests
import streamlit as st


VENTADIARIA_FILE_ID = "12c7hy-bTbg7P_1QYUyKKcooNLo4iog1x"
OBJETIVO_FILE_ID = "1qw127SPBgHR9Spi-0SA8TKLRBhpJ_Xg7"
AUXILIARES_FILE_ID = "1zXhbWtT7K1tY43MmYz7oTTYifMgmLyFT"
OBJETIVOS_AGOSTO_FILE_ID = "1qw127SPBgHR9Spi-0SA8TKLRBhpJ_Xg7"

ALLOWED_UNG = {
    "PEPSI",
    "PEPSI BLACK",
    "7 UP",
    "7 UP FREE",
    "MIRINDA",
    "PASO DE LOS TOROS",
    "H2OH",
    "GATORADE",
    "RED BULL",
    "ROCKSTAR",
}
ALLOWED_AGUAS = {"NESTLE PUREZA VITAL", "GLACIAR", "ECO DE LOS ANDES"}
ALLOWED_MARKETPLACE = {
    "ANGELITA",
    "APOSTOLES",
    "PLAYADITO",
    "JAGERMEISTER",
    "RESTINGA",
    "PATAGONIA MKTP",
    "BUDWEISER MARKETPLACE",
    "7 UP MARKETPLACE",
    "STELLA ARTOIS MARKETPLACE",
}


def norm(value) -> str:
    return str(value or "").strip().upper()


@st.cache_data(ttl=900)
def download_drive(file_id: str) -> bytes:
    url = f"https://drive.google.com/uc?export=download&id={file_id}"
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    return response.content


def number_from_ar(value) -> float:
    if pd.isna(value) or value == "":
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace(".", "").replace(",", ".").replace("%", "")
    try:
        return float(text)
    except ValueError:
        return 0.0


def first_existing(df: pd.DataFrame, names: list[str]) -> str | None:
    for name in names:
        if name in df.columns:
            return name
    return None


@st.cache_data(ttl=900)
def load_venta() -> pd.DataFrame:
    raw = download_drive(VENTADIARIA_FILE_ID)
    df = pd.read_csv(BytesIO(raw), sep="\t", encoding="cp1252", dtype=str)

    rename = {
        "Descripción Período": "fecha",
        "Cod. Cliente": "cliente_codigo",
        "Descripción": "cliente",
        "Vendedor": "vendedor_codigo",
        "Descripción Vendedor": "promotor",
        "Código": "sku_codigo",
        "Artículos por Precio": "sku",
        "Descripción.4": "marca",
        "Descripción__4": "marca",
        "Descripción.5": "calibre",
        "Descripción__5": "calibre",
        "Descripción.7": "grupo_producto",
        "Descripción__7": "grupo_producto",
        "Descripción.9": "unidad_negocio",
        "Descripción__9": "unidad_negocio",
        "Cantidades Totales": "hl",
        "Importes Netos": "importe",
        "Cantidad de Facturas": "facturas",
        "Cantidades en Combos": "combos",
    }
    duplicate_count = {}
    fixed_columns = []
    for column in df.columns:
      count = duplicate_count.get(column, 0)
      duplicate_count[column] = count + 1
      fixed_columns.append(column if count == 0 else f"{column}__{count + 1}")
    df.columns = fixed_columns
    normalized = {}
    for old, new in rename.items():
        if old in df.columns:
            normalized[old] = new
    df = df.rename(columns=normalized)

    for column in ["marca", "calibre", "grupo_producto", "unidad_negocio", "promotor", "cliente", "sku"]:
        if column not in df.columns:
            df[column] = ""
    for column in ["hl", "importe", "facturas", "combos"]:
        if column not in df.columns:
            df[column] = 0
        df[column] = df[column].map(number_from_ar)

    df["fecha_dt"] = pd.to_datetime(df["fecha"], format="%d-%b-%y", errors="coerce")
    df["marca_norm"] = df["marca"].map(norm)
    df["calibre_norm"] = df["calibre"].map(norm)
    df["es_combo"] = df["sku"].fillna("").str.upper().str.contains("COMBO") | (df["combos"] > 0)
    df["negocio"] = df["marca_norm"].map(classify_business)
    gatorade_combo = df["es_combo"] & df["sku"].fillna("").str.upper().str.contains("GATORADE|GTD")
    df.loc[gatorade_combo, ["marca", "marca_norm", "calibre", "calibre_norm", "grupo_producto", "negocio"]] = [
        "GATORADE",
        "GATORADE",
        "Combo",
        "COMBO",
        "Combo Gatorade",
        "UNG",
    ]
    return df[df["negocio"].isin(["UNG", "Aguas", "Marketplace"])].copy()


def classify_business(brand: str) -> str:
    if brand in ALLOWED_MARKETPLACE:
        return "Marketplace"
    if brand in ALLOWED_AGUAS:
        return "Aguas"
    if brand in ALLOWED_UNG:
        return "UNG"
    return "Excluido"


@st.cache_data(ttl=3600)
def load_auxiliares() -> tuple[set[tuple[str, str]], set[tuple[str, str]]]:
    raw = download_drive(AUXILIARES_FILE_ID)
    aux = pd.read_excel(BytesIO(raw), sheet_name=0)
    right = aux[["Marca", "Calibre", "CALIBRES CPR"]].dropna(subset=["Marca", "Calibre", "CALIBRES CPR"])
    familiar = set()
    top = set()
    for _, row in right.iterrows():
        pair = (norm(row["Marca"]), norm(row["Calibre"]))
        category = norm(row["CALIBRES CPR"])
        if category == "FAMILIARES":
            familiar.add(pair)
        if category == "TOP":
            top.add(pair)
    return familiar, top


@st.cache_data(ttl=3600)
def load_objetivos() -> dict:
    raw = download_drive(OBJETIVO_FILE_ID)
    book = pd.read_excel(BytesIO(raw), sheet_name=None, header=None)
    sheet = next(iter(book.values()))
    header_row = sheet.index[(sheet.iloc[:, 0].astype(str).str.upper() == "SELECCIÓN")].tolist()[0]
    total_row = sheet.index[sheet.iloc[:, 1].astype(str).str.contains("7-UP", case=False, na=False)].tolist()[0]
    sellers = {}
    for col in range(2, sheet.shape[1]):
        label = str(sheet.iat[header_row, col])
        match = re.match(r"\d+-(.+)", label)
        if match:
            value = number_from_ar(sheet.iat[total_row, col])
            if value:
                sellers[norm(match.group(1))] = value
    return {"hl_total": sum(sellers.values()), "hl_by_seller": sellers, "hl_row": sheet.iat[total_row, 1]}


@st.cache_data(ttl=3600)
def load_objetivos_agosto() -> dict:
    raw = download_drive("1qw127SPBgHR9Spi-0SA8TKLRBhpJ_Xg7")
    # Streamlit deploy uses OBJETIVO.xlsx by default. The full monthly workbook can be uploaded later.
    return {}


def bd_count(df: pd.DataFrame) -> int:
    return df[["cliente_codigo", "sku_codigo"]].dropna().drop_duplicates().shape[0]


def ccc_count(df: pd.DataFrame) -> int:
    return df["cliente_codigo"].dropna().nunique()


def performance_rows(df: pd.DataFrame, familiar_pairs: set, top_pairs: set) -> pd.DataFrame:
    csd_brands = {"PEPSI", "PEPSI BLACK", "7 UP", "7 UP FREE", "MIRINDA", "PASO DE LOS TOROS", "H2OH"}
    masks = {
        "BD Total NABS": (df["negocio"] != "Marketplace", "BD", 9423.9),
        "BD Gatorade": (df["marca_norm"].eq("GATORADE"), "BD", 1773.4),
        "BD CSDs MS": (df.apply(lambda r: (r["marca_norm"], r["calibre_norm"]) in familiar_pairs and r["marca_norm"] in csd_brands, axis=1), "BD", 3863.8),
        "BD TOP": (df.apply(lambda r: (r["marca_norm"], r["calibre_norm"]) in top_pairs, axis=1), "BD", 4982.3),
        "BD Energia": (df["marca_norm"].isin(["RED BULL", "ROCKSTAR"]), "BD", 695.1),
        "BD Aguas": (df["negocio"].eq("Aguas"), "BD", 1463.1),
        "BD Marketplace puro": (df["negocio"].eq("Marketplace"), "BD", 588.8),
        "CCC NABS": (df["negocio"] != "Marketplace", "CCC", 1215.7),
        "CCC Black": (df["marca_norm"].str.contains("BLACK|FREE", na=False), "CCC", 298.6),
        "CCC H2Oh": (df["marca_norm"].eq("H2OH"), "CCC", 320.4),
    }
    elapsed = max(df["fecha_dt"].dropna().dt.date.nunique(), 1)
    out = []
    for label, (mask, kind, objective) in masks.items():
        real = bd_count(df[mask]) if kind == "BD" else ccc_count(df[mask])
        trend = real / elapsed * 26
        out.append(
            {
                "Objetivo": label,
                "Tipo": kind,
                "Meta": round(objective, 1),
                "Real": real,
                "Avance": real / objective if objective else 0,
                "Faltante": max(objective - real, 0),
                "Tendencia": round(trend, 0),
            }
        )
    return pd.DataFrame(out)


st.set_page_config(page_title="Taco NABS", layout="wide")
st.title("Taco NABS")

with st.spinner("Cargando venta diaria y objetivos..."):
    venta = load_venta()
    familiar_pairs, top_pairs = load_auxiliares()
    objetivos = load_objetivos()

with st.sidebar:
    st.header("Filtros")
    promotor = st.multiselect("Promotor", sorted(venta["promotor"].dropna().unique()))
    negocio = st.multiselect("Negocio", sorted(venta["negocio"].dropna().unique()))
    marca = st.multiselect("Marca", sorted(venta["marca"].dropna().unique()))
    calibre = st.multiselect("Calibre", sorted(venta["calibre"].dropna().unique()))

filtered = venta.copy()
if promotor:
    filtered = filtered[filtered["promotor"].isin(promotor)]
if negocio:
    filtered = filtered[filtered["negocio"].isin(negocio)]
if marca:
    filtered = filtered[filtered["marca"].isin(marca)]
if calibre:
    filtered = filtered[filtered["calibre"].isin(calibre)]

tabs = st.tabs(["Resumen", "Performance Objetivos", "Brand / SKUs", "Clientes con Compra", "Combos"])

with tabs[0]:
    total_hl = filtered["hl"].sum()
    objective_hl = objetivos["hl_total"]
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Venta acumulada", f"{total_hl:,.1f} HL")
    col2.metric("Objetivo HL", f"{objective_hl:,.0f}")
    col3.metric("% avance", f"{(total_hl / objective_hl * 100 if objective_hl else 0):,.1f}%")
    col4.metric("Faltante", f"{max(objective_hl - total_hl, 0):,.1f} HL")
    st.line_chart(filtered.groupby("fecha_dt")["hl"].sum())

with tabs[1]:
    perf = performance_rows(filtered, familiar_pairs, top_pairs)
    st.dataframe(
        perf.style.format({"Meta": "{:,.1f}", "Avance": "{:.1%}", "Faltante": "{:,.1f}", "Tendencia": "{:,.0f}"}),
        use_container_width=True,
        hide_index=True,
    )

with tabs[2]:
    seller_business = (
        filtered.groupby(["promotor", "negocio"])
        .agg(SKUs=("sku_codigo", "nunique"), CCC=("cliente_codigo", "nunique"), HL=("hl", "sum"), Importe=("importe", "sum"))
        .reset_index()
        .sort_values("SKUs", ascending=False)
    )
    st.dataframe(seller_business, use_container_width=True, hide_index=True)

with tabs[3]:
    active = (
        filtered.groupby(["fecha_dt", "cliente_codigo", "cliente", "promotor"])
        .agg(SKUs=("sku_codigo", "nunique"), HL=("hl", "sum"), Importe=("importe", "sum"))
        .reset_index()
        .sort_values(["fecha_dt", "promotor"])
    )
    st.dataframe(active, use_container_width=True, hide_index=True)

with tabs[4]:
    combos = filtered[filtered["es_combo"]]
    by_combo = (
        combos.groupby("sku")
        .agg(CCC=("cliente_codigo", "nunique"), Promotores=("promotor", "nunique"), Importe=("importe", "sum"), Lineas=("sku", "size"))
        .reset_index()
        .sort_values("CCC", ascending=False)
    )
    st.metric("Objetivo combos", "170")
    st.dataframe(by_combo, use_container_width=True, hide_index=True)
