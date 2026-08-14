import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertCircle,
  Archive,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  Search,
  UploadCloud
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import * as XLSXStyle from "xlsx-js-style";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "" : "http://127.0.0.1:4100");
const EXCEL_LIB = XLSXStyle.default || XLSXStyle;
const SHEETS = [
  { id: "resumen", label: "Resumen Ejecutivo" },
  { id: "seguimiento", label: "Seguimiento" },
  { id: "objetivos", label: "Performance Objetivos" },
  { id: "volumen", label: "Volumen" },
  { id: "coberturas", label: "Coberturas / CCC" },
  { id: "brand", label: "Brand / SKUs" },
  { id: "clientes", label: "Clientes con Compra" },
  { id: "marketplace", label: "Marketplace" },
  { id: "combos", label: "Combos y Focos" },
  { id: "historico", label: "Histórico Mensual" },
  { id: "detalle", label: "Detalle Operativo" },
  { id: "calidad", label: "Calidad" },
  { id: "carga", label: "Carga Mensual" }
];

function shortenApiText(text) {
  const clean = String(text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > 180 ? `${clean.slice(0, 180)}...` : clean;
}

async function readApiPayload(response) {
  const contentType = response.headers.get("content-type") || "";
  const responseText = await response.text();
  if (contentType.includes("application/json")) {
    return responseText ? JSON.parse(responseText) : {};
  }
  if (responseText.trim().startsWith("<")) {
    return {
      error: "La API devolvió una página HTML en vez de datos. Esperá que Render termine el deploy y volvé a probar."
    };
  }
  return {
    error: shortenApiText(responseText) || "La API no devolvió respuesta. Probá nuevamente en unos segundos."
  };
}

function money(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function number(value, digits = 1) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: digits
  }).format(value || 0);
}

function percent(value) {
  if (value === null || value === undefined) return "Pendiente";
  return `${number(value * 100, 1)}%`;
}

function Metric({ title, value, sub, icon: Icon, tone = "neutral" }) {
  return (
    <section className={`metric ${tone}`}>
      <div className="metricIcon">{Icon ? <Icon size={18} /> : null}</div>
      <div>
        <p>{title}</p>
        <strong>{value}</strong>
        {sub ? <span>{sub}</span> : null}
      </div>
    </section>
  );
}

function Panel({ title, sub, icon: Icon, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panelHeader">
        <div>
          <h2>{title}</h2>
          {sub ? <p>{sub}</p> : null}
        </div>
        {Icon ? <Icon size={21} /> : null}
      </div>
      {children}
    </section>
  );
}

function SelectFilter({ label, value, options, onChange }) {
  return (
    <label>
      {label}
      <select value={value || ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">Todos</option>
        {(options || []).slice(0, 500).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Filters({ data, filters, setFilters, refresh, loading }) {
  const options = data?.filters || {};
  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const clear = () => setFilters({});
  return (
    <Panel title="Filtros" sub="Mes, fecha de corte, supervisor, promotor, negocio, producto, marca, calibre, canal y cliente." icon={Filter}>
      <div className="filterGrid">
        <SelectFilter label="Mes" value={filters.mes} options={options.mes} onChange={(v) => update("mes", v)} />
        <label>
          Desde
          <input type="date" value={filters.fechaDesde || ""} onChange={(event) => update("fechaDesde", event.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={filters.fechaHasta || ""} onChange={(event) => update("fechaHasta", event.target.value)} />
        </label>
        <SelectFilter label="Fecha" value={filters.fecha} options={options.fecha} onChange={(v) => update("fecha", v)} />
        <SelectFilter label="Supervisor" value={filters.supervisor} options={options.supervisor} onChange={(v) => update("supervisor", v)} />
        <SelectFilter label="Promotor" value={filters.promotor} options={options.promotor} onChange={(v) => update("promotor", v)} />
        <SelectFilter label="Negocio" value={filters.negocio} options={options.negocio} onChange={(v) => update("negocio", v)} />
        <SelectFilter label="Grupo producto" value={filters.grupoProducto} options={options.grupoProducto} onChange={(v) => update("grupoProducto", v)} />
        <SelectFilter label="Marca" value={filters.marca} options={options.marca} onChange={(v) => update("marca", v)} />
        <SelectFilter label="Calibre" value={filters.calibre} options={options.calibre} onChange={(v) => update("calibre", v)} />
        <SelectFilter label="SKU" value={filters.sku} options={options.sku} onChange={(v) => update("sku", v)} />
        <SelectFilter label="Combo" value={filters.combo} options={options.combo} onChange={(v) => update("combo", v)} />
        <SelectFilter label="Canal" value={filters.canal} options={options.canal} onChange={(v) => update("canal", v)} />
        <SelectFilter label="Cliente" value={filters.cliente} options={options.cliente} onChange={(v) => update("cliente", v)} />
      </div>
      <div className="filterActions">
        <button className="secondaryButton" onClick={clear} type="button">
          Limpiar
        </button>
        <button className="iconButton" onClick={refresh} disabled={loading} type="button">
          <RefreshCw size={17} />
          Aplicar
        </button>
      </div>
    </Panel>
  );
}

function SimpleTable({ columns, rows, limit = 12 }) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(rows || []).slice(0, limit).map((row, index) => (
            <tr key={`${row.label || row.id || index}-${index}`}>
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(row[column.key], row) : row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UploadPanel() {
  const [file, setFile] = useState(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!file) return;
    setLoading(true);
    setStatus(null);
    const body = new FormData();
    body.append("file", file);
    body.append("month", month);
    const response = await fetch(`${API_URL}/api/monthly-focus`, { method: "POST", body });
    const payload = await readApiPayload(response);
    setLoading(false);
    setStatus(response.ok ? { type: "ok", payload } : { type: "error", payload });
  }

  return (
    <Panel title="Excel mensual" sub="Focos y objetivos del mes. Se guarda en Drive." icon={FileSpreadsheet}>
      <form onSubmit={submit}>
        <label>
          Mes
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
        <label className="fileInput">
          <UploadCloud size={18} />
          <span>{file ? file.name : "Seleccionar Excel de focos y objetivos"}</span>
          <input type="file" accept=".xlsx,.xls" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        </label>
        <button disabled={!file || loading} type="submit">
          {loading ? "Subiendo..." : "Guardar en Drive"}
        </button>
      </form>
      {status ? (
        <div className={`status ${status.type}`}>
          {status.type === "ok" ? `Guardado: ${status.payload.driveFile?.name || "archivo mensual"}` : status.payload.error}
        </div>
      ) : null}
    </Panel>
  );
}

function MonthlyHistoryPanel({ closures, data, onCloseMonth, closingMonth }) {
  const [month, setMonth] = useState(data?.filters?.mes?.at(-1) || new Date().toISOString().slice(0, 7));
  const [status, setStatus] = useState(null);

  async function closeMonth() {
    setStatus(null);
    const result = await onCloseMonth(month);
    setStatus(result);
  }

  const summaryRows = (closures || []).map((closure) => ({
    month: closure.month,
    hl: closure.totals?.hl,
    clientes: closure.totals?.clientes,
    skus: closure.totals?.skus,
    importeNeto: closure.totals?.importeNeto,
    objetivo: closure.executive?.objective,
    avance: closure.executive?.progress,
    tendencia: closure.executive?.projectedClose,
    estado: closure.executive?.status,
    storage: closure.storage === "drive" ? "Drive" : "Local"
  }));

  return (
    <section className="wideGrid">
      <Panel title="Cerrar mes" sub="Genera el cierre mensual y descarga un Excel en esta computadora." icon={Archive}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            closeMonth();
          }}
        >
          <label>
            Mes a cerrar
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
          <button disabled={closingMonth || !month} type="submit">
            {closingMonth ? "Generando..." : "Cerrar mes"}
          </button>
        </form>
        {status ? (
          <div className={`status ${status.type}`}>
            {status.type === "ok" ? `Cierre ${status.month} generado y descargado en Excel.` : status.error}
          </div>
        ) : null}
      </Panel>
      <Panel title="Histórico mensual" sub="Indicadores cerrados, sin recalcular archivos pesados." icon={CalendarDays}>
        <SimpleTable
          columns={[
            { key: "month", label: "Mes" },
            { key: "hl", label: "HL", render: (v) => number(v) },
            { key: "objetivo", label: "Objetivo", render: (v) => (v ? number(v) : "Pendiente") },
            { key: "avance", label: "Avance", render: (v) => percent(v) },
            { key: "clientes", label: "CCC", render: (v) => number(v, 0) },
            { key: "skus", label: "SKUs", render: (v) => number(v, 0) },
            { key: "importeNeto", label: "Importe", render: (v) => money(v) },
            { key: "estado", label: "Semáforo" },
            { key: "storage", label: "Guardado" }
          ]}
          rows={summaryRows}
          limit={24}
        />
      </Panel>
      <Panel title="Ranking último cierre" sub="Promotores del cierre mensual más reciente." icon={BarChart3}>
        <SimpleTable columns={[
          { key: "label", label: "Promotor" },
          { key: "hl", label: "HL", render: (v) => number(v) },
          { key: "clientes", label: "CCC", render: (v) => number(v, 0) },
          { key: "skus", label: "SKUs", render: (v) => number(v, 0) },
          { key: "importeNeto", label: "Importe", render: (v) => money(v) }
        ]} rows={closures?.[0]?.tables?.bySeller || []} limit={30} />
      </Panel>
    </section>
  );
}

function downloadDetail(rows, preferredHeaders = null) {
  const headers =
    preferredHeaders ||
    ["fecha", "supervisor", "vendedor", "cliente", "marca", "calibre", "productoEstadistico", "negocio", "hl", "importeNeto", "facturas"];
  const csv = [headers.join(",")]
    .concat(
      (rows || []).map((row) =>
        headers
          .map((key) => `"${String(row[key] ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "detalle-operativo.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function cleanSheetName(name) {
  return String(name).replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
}

const EXPORT_LABELS = {
  indicador: "Indicador",
  valor: "Valor",
  filtro: "Filtro",
  mes: "Mes",
  month: "Mes",
  fecha: "Fecha",
  date: "Fecha",
  fechaCierre: "Fecha cierre",
  closedAt: "Fecha cierre",
  sourceFile: "Archivo fuente",
  archivo: "Archivo",
  label: "Nombre",
  name: "Nombre",
  promotor: "Promotor",
  vendedor: "Vendedor",
  seller: "Promotor",
  supervisor: "Supervisor",
  negocio: "Negocio",
  business: "Negocio",
  grupoProducto: "Grupo producto",
  productGroup: "Grupo producto",
  marca: "Marca",
  brand: "Marca",
  calibre: "Calibre",
  caliber: "Calibre",
  sku: "SKU",
  skus: "SKUs",
  cliente: "Cliente",
  client: "Cliente",
  clienteId: "Cliente ID",
  clientes: "CCC",
  ccc: "CCC",
  facturas: "Facturas",
  invoices: "Facturas",
  hl: "HL",
  importe: "Importe",
  importeNeto: "Importe neto",
  importeFinal: "Importe final",
  objective: "Objetivo",
  objetivo: "Objetivo",
  real: "Real",
  avance: "Avance",
  progress: "Avance",
  faltante: "Faltante",
  missing: "Faltante",
  tendencia: "Tendencia",
  projectedClose: "Tendencia cierre",
  tendenciaAvance: "Tend. avance",
  semaforo: "Semáforo",
  status: "Semáforo",
  guardado: "Guardado",
  storage: "Guardado",
  rows: "Registros",
  totalRows: "Registros",
  loadedRows: "Registros cargados",
  generatedRows: "Registros incluidos",
  duplicates: "Duplicados",
  missingHeaders: "Columnas faltantes",
  combos: "Combos",
  combo: "Combo",
  comboProductos: "Líneas combo",
  activacionesDia: "Activaciones día",
  nuevosDia: "Nuevos día",
  clientesUnicos: "Clientes únicos",
  activosMes: "Acum. activos mes"
};

function prettyExportLabel(key) {
  if (EXPORT_LABELS[key]) return EXPORT_LABELS[key];
  return String(key)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function cleanExportValue(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function orderedKeys(rows) {
  const keys = [];
  for (const row of rows) {
    for (const key of Object.keys(row || {})) {
      if (!keys.includes(key)) keys.push(key);
    }
  }
  return keys.length ? keys : ["mensaje"];
}

function excelNumberFormat(label) {
  const normalized = label.toLowerCase();
  if (normalized.includes("avance") || normalized.includes("%")) return "0.0%";
  if (normalized.includes("importe")) return '$ #,##0';
  if (normalized === "hl") return "#,##0.0";
  if (
    normalized.includes("ccc") ||
    normalized.includes("sku") ||
    normalized.includes("factura") ||
    normalized.includes("registro") ||
    normalized.includes("cliente") ||
    normalized.includes("objetivo") ||
    normalized.includes("real") ||
    normalized.includes("faltante") ||
    normalized.includes("tendencia") ||
    normalized.includes("combo")
  ) {
    return "#,##0";
  }
  return "#,##0.00";
}

function addJsonSheet(XLSX, workbook, name, rows) {
  const safeRows = rows?.length ? rows : [{ mensaje: "Sin datos" }];
  const keys = orderedKeys(safeRows);
  const headers = keys.map(prettyExportLabel);
  const body = safeRows.map((row) => keys.map((key) => cleanExportValue(row?.[key])));
  const sheet = XLSX.utils.aoa_to_sheet([[name], headers, ...body]);
  const lastCol = Math.max(headers.length - 1, 0);
  const lastRow = body.length + 1;

  sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }];
  sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 1, c: 0 }, e: { r: lastRow, c: lastCol } }) };
  sheet["!freeze"] = { xSplit: 0, ySplit: 2 };
  sheet["!cols"] = headers.map((header, index) => {
    const maxBody = body.reduce((max, row) => Math.max(max, String(row[index] ?? "").length), 0);
    return { wch: Math.min(Math.max(header.length + 2, maxBody + 2, 12), 42) };
  });

  const titleStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 16 },
    fill: { fgColor: { rgb: "102A43" } },
    alignment: { horizontal: "left", vertical: "center" }
  };
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "0F766E" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "D9E2EC" } },
      bottom: { style: "thin", color: { rgb: "D9E2EC" } },
      left: { style: "thin", color: { rgb: "D9E2EC" } },
      right: { style: "thin", color: { rgb: "D9E2EC" } }
    }
  };
  const cellBorder = {
    bottom: { style: "thin", color: { rgb: "E6EEF5" } }
  };

  for (let column = 0; column <= lastCol; column += 1) {
    const titleAddress = XLSX.utils.encode_cell({ r: 0, c: column });
    if (!sheet[titleAddress]) sheet[titleAddress] = { t: "s", v: "" };
    sheet[titleAddress].s = titleStyle;

    const headerAddress = XLSX.utils.encode_cell({ r: 1, c: column });
    sheet[headerAddress].s = headerStyle;
  }

  for (let rowIndex = 0; rowIndex < body.length; rowIndex += 1) {
    const fill = rowIndex % 2 === 0 ? "F8FBFD" : "FFFFFF";
    for (let column = 0; column <= lastCol; column += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex + 2, c: column });
      if (!sheet[address]) continue;
      sheet[address].s = {
        fill: { fgColor: { rgb: fill } },
        border: cellBorder,
        alignment: { vertical: "center" }
      };
      if (typeof sheet[address].v === "number") {
        sheet[address].z = excelNumberFormat(headers[column]);
      }
    }
  }

  XLSX.utils.book_append_sheet(workbook, sheet, cleanSheetName(name));
}

async function exportDashboardWorkbook(data, closures, filters) {
  if (!data) return;
  const XLSX = EXCEL_LIB;
  const workbook = XLSX.utils.book_new();
  const filterRows = Object.entries(filters || {}).map(([filtro, valor]) => ({ filtro, valor }));
  addJsonSheet(XLSX, workbook, "Filtros", filterRows.length ? filterRows : [{ filtro: "Sin filtros", valor: "" }]);
  addJsonSheet(XLSX, workbook, "Resumen", [
    { indicador: "Venta acumulada HL", valor: data.totals?.hl },
    { indicador: "Objetivo mensual", valor: data.executive?.objective },
    { indicador: "Avance", valor: data.executive?.progress },
    { indicador: "Tendencia cierre", valor: data.executive?.projectedClose },
    { indicador: "Faltante", valor: data.executive?.missing },
    { indicador: "Días hábiles transcurridos", valor: data.executive?.elapsedBusinessDays },
    { indicador: "Días hábiles restantes", valor: data.executive?.remainingBusinessDays },
    { indicador: "Semáforo", valor: data.executive?.status },
    { indicador: "Importe neto", valor: data.totals?.importeNeto },
    { indicador: "Clientes CCC", valor: data.totals?.clientes },
    { indicador: "SKUs", valor: data.totals?.skus },
    { indicador: "Registros", valor: data.totalRows }
  ]);
  addJsonSheet(XLSX, workbook, "Venta diaria", data.byDay);
  addJsonSheet(XLSX, workbook, "Ranking HL", data.bySeller);
  addJsonSheet(XLSX, workbook, "Ranking CCC", data.bySellerCcc);
  addJsonSheet(XLSX, workbook, "Objetivo Promotor", data.objectiveDistribution?.bySeller);
  addJsonSheet(XLSX, workbook, "Performance Objetivos", data.objectivePerformance);
  addJsonSheet(XLSX, workbook, "Volumen Negocio", data.byBusiness);
  addJsonSheet(XLSX, workbook, "Volumen Marca", data.byBrand);
  addJsonSheet(XLSX, workbook, "Volumen Calibre", data.byCaliber);
  addJsonSheet(XLSX, workbook, "CCC UNG", data.coverage?.cccTotalUng);
  addJsonSheet(XLSX, workbook, "CCC Aguas", data.coverage?.cccAguas);
  addJsonSheet(XLSX, workbook, "CCC Red Bull", data.coverage?.cccRedBull);
  addJsonSheet(XLSX, workbook, "CCC Marketplace", data.coverage?.cccMarketplace);
  addJsonSheet(XLSX, workbook, "CCC Producto", data.coverage?.byProduct);
  addJsonSheet(XLSX, workbook, "BD Cliente SKU", data.brandDistribution?.skusByClient);
  addJsonSheet(XLSX, workbook, "BD Promotor Negocio", data.brandDistribution?.byPromotorNegocio);
  addJsonSheet(XLSX, workbook, "BD Marca Calibre", data.brandDistribution?.byPromotorMarcaCalibre);
  addJsonSheet(XLSX, workbook, "Clientes Activados", data.customerPurchases?.bySeller);
  addJsonSheet(XLSX, workbook, "Detalle Clientes", data.customerPurchases?.detail);
  addJsonSheet(XLSX, workbook, "Marketplace", data.marketplace?.bySeller);
  addJsonSheet(XLSX, workbook, "Combos CCC", data.combosFocus?.byComboCcc);
  addJsonSheet(XLSX, workbook, "Combos Promotor", data.combosFocus?.bySeller);
  addJsonSheet(XLSX, workbook, "Detalle Operativo", data.operationalDetail);
  addJsonSheet(XLSX, workbook, "Calidad", [
    { indicador: "Archivo", valor: data.quality?.sourceFile },
    { indicador: "Registros cargados", valor: data.quality?.loadedRows },
    { indicador: "Duplicados", valor: data.quality?.duplicates },
    { indicador: "Columnas faltantes", valor: (data.quality?.missingHeaders || []).join(", ") || "Sin faltantes" }
  ]);
  addJsonSheet(XLSX, workbook, "Historico Mensual", (closures || []).map((closure) => ({
    mes: closure.month,
    hl: closure.totals?.hl,
    objetivo: closure.executive?.objective,
    avance: closure.executive?.progress,
    ccc: closure.totals?.clientes,
    skus: closure.totals?.skus,
    importeNeto: closure.totals?.importeNeto,
    semaforo: closure.executive?.status,
    guardado: closure.storage
  })));
  XLSX.writeFile(workbook, `dashboard-ventas-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

async function exportMonthlyClosureWorkbook(closure) {
  if (!closure) return;
  const XLSX = EXCEL_LIB;
  const workbook = XLSX.utils.book_new();
  addJsonSheet(XLSX, workbook, "Resumen", [
    { indicador: "Mes", valor: closure.month },
    { indicador: "Fecha cierre", valor: closure.closedAt },
    { indicador: "Archivo fuente", valor: closure.sourceFile },
    { indicador: "Venta acumulada HL", valor: closure.totals?.hl },
    { indicador: "Objetivo mensual", valor: closure.executive?.objective },
    { indicador: "Avance", valor: closure.executive?.progress },
    { indicador: "Tendencia cierre", valor: closure.executive?.projectedClose },
    { indicador: "Faltante", valor: closure.executive?.missing },
    { indicador: "Días hábiles transcurridos", valor: closure.executive?.elapsedBusinessDays },
    { indicador: "Días hábiles restantes", valor: closure.executive?.remainingBusinessDays },
    { indicador: "Semáforo", valor: closure.executive?.status },
    { indicador: "Importe neto", valor: closure.totals?.importeNeto },
    { indicador: "Clientes CCC", valor: closure.totals?.clientes },
    { indicador: "SKUs", valor: closure.totals?.skus },
    { indicador: "Registros incluidos", valor: closure.generatedRows }
  ]);
  addJsonSheet(XLSX, workbook, "Ranking Promotor", closure.tables?.bySeller);
  addJsonSheet(XLSX, workbook, "Ranking CCC", closure.tables?.bySellerCcc);
  addJsonSheet(XLSX, workbook, "Objetivos", closure.tables?.objectivePerformance);
  addJsonSheet(XLSX, workbook, "Objetivo Promotor", closure.tables?.objectiveDistribution);
  addJsonSheet(XLSX, workbook, "Volumen Negocio", closure.tables?.byBusiness);
  addJsonSheet(XLSX, workbook, "Volumen Marca", closure.tables?.byBrand);
  addJsonSheet(XLSX, workbook, "Volumen Calibre", closure.tables?.byCaliber);
  addJsonSheet(XLSX, workbook, "Cobertura UNG", closure.tables?.coverageUng);
  addJsonSheet(XLSX, workbook, "Cobertura Aguas", closure.tables?.coverageAguas);
  addJsonSheet(XLSX, workbook, "Cobertura Marketplace", closure.tables?.coverageMarketplace);
  addJsonSheet(XLSX, workbook, "Brand Negocio", closure.tables?.brandByPromotorNegocio);
  addJsonSheet(XLSX, workbook, "Combos Promotor", closure.tables?.combosBySeller);
  addJsonSheet(XLSX, workbook, "Combos CCC", closure.tables?.combosByComboCcc);
  addJsonSheet(XLSX, workbook, "Marketplace", closure.tables?.marketplaceBySeller);
  addJsonSheet(XLSX, workbook, "Calidad", [
    { indicador: "Registros cargados", valor: closure.quality?.loadedRows },
    { indicador: "Duplicados", valor: closure.quality?.duplicates },
    { indicador: "Columnas faltantes", valor: (closure.quality?.missingHeaders || []).join(", ") || "Sin faltantes" }
  ]);
  XLSX.writeFile(workbook, `cierre-${closure.month || new Date().toISOString().slice(0, 7)}.xlsx`);
}

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [closures, setClosures] = useState([]);
  const [closingMonth, setClosingMonth] = useState(false);
  const [detailSearch, setDetailSearch] = useState("");
  const [activeSheet, setActiveSheet] = useState("resumen");

  async function load(currentFilters = filters) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(Object.entries(currentFilters).filter(([, value]) => value));
      const response = await fetch(`${API_URL}/api/dashboard?${params.toString()}`);
      const payload = await readApiPayload(response);
      if (!response.ok) throw new Error(payload.error);
      setData(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadClosures() {
    try {
      const response = await fetch(`${API_URL}/api/monthly-closures`);
      const payload = await readApiPayload(response);
      if (response.ok) setClosures(payload.closes || []);
    } catch {
      setClosures([]);
    }
  }

  async function closeMonth(month) {
    setClosingMonth(true);
    try {
      const response = await fetch(`${API_URL}/api/monthly-closures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month })
      });
      const payload = await readApiPayload(response);
      if (!response.ok) throw new Error(payload.error);
      if (!payload.closure) throw new Error(payload.error || "No se pudo generar el cierre mensual.");
      await exportMonthlyClosureWorkbook(payload.closure);
      await loadClosures();
      return {
        type: "ok",
        month: payload.closure?.month || month
      };
    } catch (err) {
      return { type: "error", error: err.message };
    } finally {
      setClosingMonth(false);
    }
  }

  useEffect(() => {
    load({});
    loadClosures();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      load(filters);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [filters]);

  useEffect(() => {
    if (activeSheet === "objetivos" && !data?.objectivePerformance?.length) {
      load(filters);
    }
  }, [activeSheet]);

  const byDay = useMemo(() => data?.byDay || [], [data]);
  const detailRows = useMemo(() => {
    const term = detailSearch.toLowerCase();
    if (!term) return data?.operationalDetail || [];
    return (data?.operationalDetail || []).filter((row) =>
      [row.supervisor, row.vendedor, row.cliente, row.marca, row.calibre, row.productoEstadistico, row.negocio].some((value) =>
        String(value || "").toLowerCase().includes(term)
      )
    );
  }, [data, detailSearch]);

  const sellerColumns = [
    { key: "label", label: "Promotor" },
    { key: "hl", label: "HL", render: (v) => number(v) },
    { key: "clientes", label: "CCC", render: (v) => number(v, 0) },
    { key: "importeNeto", label: "Importe", render: (v) => money(v) },
    { key: "facturas", label: "Facturas", render: (v) => number(v, 0) }
  ];
  const brandColumns = [
    { key: "label", label: "Marca" },
    { key: "hl", label: "HL", render: (v) => number(v) },
    { key: "clientes", label: "CCC", render: (v) => number(v, 0) },
    { key: "skus", label: "SKUs", render: (v) => number(v, 0) },
    { key: "importeNeto", label: "Importe", render: (v) => money(v) }
  ];
  const caliberColumns = [
    { key: "label", label: "Calibre" },
    { key: "hl", label: "HL", render: (v) => number(v) },
    { key: "clientes", label: "CCC", render: (v) => number(v, 0) },
    { key: "skus", label: "SKUs", render: (v) => number(v, 0) },
    { key: "importeNeto", label: "Importe", render: (v) => money(v) }
  ];
  const coverageColumns = [
    { key: "label", label: "Promotor" },
    { key: "clientes", label: "CCC", render: (v) => number(v, 0) },
    { key: "hl", label: "HL", render: (v) => number(v) },
    { key: "importeNeto", label: "Importe", render: (v) => money(v) }
  ];

  return (
    <main>
      <header className="topbar">
        <div>
          <h1>Dashboard Ventas Diarias</h1>
          <p>Fuente activa: ventadiaria.txt. Solo UNG, Aguas, MKTP y Match.</p>
        </div>
        <div className="topbarActions">
          <button className="secondaryButton" onClick={() => exportDashboardWorkbook(data, closures, filters)} disabled={!data} title="Exportar Excel" type="button">
            <Download size={18} />
            Exportar Excel
          </button>
          <button className="iconButton" onClick={() => load()} disabled={loading} title="Actualizar" type="button">
            <RefreshCw size={18} />
            Actualizar
          </button>
        </div>
      </header>

      {error ? (
        <section className="error">
          <AlertCircle size={18} />
          {error}
        </section>
      ) : null}

      <Filters data={data} filters={filters} setFilters={setFilters} refresh={() => load()} loading={loading} />

      <nav className="sheetTabs" aria-label="Hojas del dashboard">
        {SHEETS.map((sheet) => (
          <button
            className={activeSheet === sheet.id ? "active" : ""}
            key={sheet.id}
            onClick={() => setActiveSheet(sheet.id)}
            type="button"
          >
            {sheet.label}
          </button>
        ))}
      </nav>

      <section className="sheetBody">
        {activeSheet === "resumen" ? (
          <>
            <section className="metricsGrid executiveGrid">
              <Metric title="Venta acumulada" value={`${number(data?.totals?.hl)} HL`} sub={`${number(data?.totalRows, 0)} registros`} icon={BarChart3} tone="green" />
              <Metric title="Objetivo mensual" value={data?.executive?.objective ? `${number(data.executive.objective)} HL` : "Pendiente"} sub="Se toma del Excel mensual" icon={FileSpreadsheet} />
              <Metric title="% avance" value={percent(data?.executive?.progress)} sub="Contra objetivo mensual" icon={CheckCircle2} />
              <Metric title="Tendencia cierre" value={`${number(data?.executive?.projectedClose)} HL`} sub={percent(data?.executive?.projectedProgress)} icon={RefreshCw} />
              <Metric title="Faltante" value={data?.executive?.missing === null ? "Pendiente" : `${number(data?.executive?.missing)} HL`} sub="Para cumplir objetivo" icon={AlertCircle} />
              <Metric title="Días hábiles" value={`${number(data?.executive?.elapsedBusinessDays, 0)} / ${number(data?.executive?.assumedBusinessDays, 0)}`} sub={`${number(data?.executive?.remainingBusinessDays, 0)} restantes`} icon={CalendarDays} />
              <Metric title="Semáforo" value={data?.executive?.status || "Sin datos"} sub="Arriba / En riesgo / Debajo" icon={Database} />
              <Metric title="Importe neto" value={money(data?.totals?.importeNeto)} sub={`${number(data?.totals?.clientes, 0)} clientes`} icon={FileSpreadsheet} />
            </section>
            <Panel title="Venta diaria" sub="Evolución de HL por día del mes." icon={CalendarDays}>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={byDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(value) => number(value, 0)} />
                  <Tooltip formatter={(value) => number(value)} />
                  <Line type="monotone" dataKey="hl" stroke="#0f766e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Panel>
          </>
        ) : null}

        {activeSheet === "seguimiento" ? (
          <section className="wideGrid">
            <Panel
              title="Objetivo distribuido por promotor"
              sub={`${data?.objectiveDistribution?.objectiveKey || "Objetivo"} repartido por HL acumulado de 3 meses.`}
              icon={FileSpreadsheet}
            >
              <section className="inlineMetrics">
                <Metric title="Objetivo foco" value={number(data?.objectiveDistribution?.totalObjective, 0)} sub={data?.objectiveDistribution?.distributor || "Sin objetivo"} />
                <Metric title="Base objetivo" value={data?.objectiveDistribution?.totalBasisHl === null ? "Drive" : `${number(data?.objectiveDistribution?.totalBasisHl)} HL`} sub={data?.objectiveDistribution?.basis || "Histórico no disponible"} />
              </section>
              <SimpleTable
                columns={[
                  { key: "promotor", label: "Promotor" },
                  { key: "objetivo", label: "Objetivo", render: (v) => number(v, 0) },
                  { key: "real", label: `Real ${data?.objectiveDistribution?.metric || ""}`, render: (v) => number(v) },
                  { key: "avance", label: "Avance", render: (v) => percent(v) },
                  { key: "faltante", label: "Faltante", render: (v) => number(v, 0) },
                  { key: "pesoHistorico", label: "Peso 3m", render: (v) => percent(v) },
                  { key: "baseHl3m", label: "HL 3m", render: (v) => number(v) }
                ]}
                rows={data?.objectiveDistribution?.bySeller || []}
                limit={24}
              />
            </Panel>
            <Panel title="Ranking por volumen HL" sub="Promotores ordenados por HL acumulados." icon={BarChart3}>
              <SimpleTable columns={sellerColumns} rows={data?.bySeller || []} limit={24} />
            </Panel>
            <Panel title="Ranking por CCC" sub="Clientes con compra por promotor." icon={CheckCircle2}>
              <SimpleTable columns={sellerColumns} rows={data?.bySellerCcc || []} limit={24} />
            </Panel>
          </section>
        ) : null}

        {activeSheet === "objetivos" ? (
          <Panel title="Performance objetivos agosto" sub="Detalle de cada objetivo del Excel mensual contra la venta diaria filtrada." icon={FileSpreadsheet}>
            <section className="inlineMetrics">
              <Metric title="Objetivos con avance" value={number(data?.objectivePerformance?.length, 0)} sub={data?.objectiveDistribution?.source || "Excel mensual"} />
              <Metric
                title="Promedio avance"
                value={percent(
                  (data?.objectivePerformance || []).length
                    ? (data.objectivePerformance || []).reduce((total, row) => total + (row.avance || 0), 0) / data.objectivePerformance.length
                    : null
                )}
                sub="Promedio simple"
              />
            </section>
            <SimpleTable
              columns={[
                { key: "label", label: "Objetivo" },
                { key: "tipo", label: "Tipo" },
                { key: "objetivo", label: "Objetivo", render: (v) => number(v, 0) },
                { key: "real", label: "Real", render: (v) => number(v, 0) },
                { key: "avance", label: "Avance", render: (v) => percent(v) },
                { key: "faltante", label: "Faltante", render: (v) => number(v, 0) },
                { key: "tendencia", label: "Tendencia", render: (v) => number(v, 0) },
                { key: "tendenciaAvance", label: "Tend. avance", render: (v) => percent(v) }
              ]}
              rows={data?.objectivePerformance || []}
              limit={40}
            />
          </Panel>
        ) : null}

        {activeSheet === "volumen" ? (
          <section className="wideGrid">
            <Panel title="Volumen por negocio" sub="UNG, Aguas, Red Bull, TOP + NS, Vinos, Sidras, Gin." icon={BarChart3}>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={data?.byBusiness?.slice(0, 14) || []} layout="vertical" margin={{ left: 110 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(value) => number(value, 0)} />
                  <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => number(value)} />
                  <Bar dataKey="hl" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Marca y calibre" sub="Pepsi, 7Up, Mirinda, Gatorade, H2Oh, Red Bull y calibres." icon={Database}>
              <SimpleTable columns={brandColumns} rows={data?.byBrand || []} limit={14} />
              <div className="spacer" />
              <SimpleTable columns={caliberColumns} rows={data?.byCaliber || []} limit={14} />
            </Panel>
          </section>
        ) : null}

        {activeSheet === "coberturas" ? (
          <section className="wideGrid">
            <Panel title="CCC UNG" sub="Clientes con compra UNG por promotor." icon={CheckCircle2}>
              <SimpleTable columns={coverageColumns} rows={data?.coverage?.cccTotalUng || []} limit={18} />
            </Panel>
            <Panel title="CCC Aguas" sub="Clientes con compra de aguas por promotor." icon={CheckCircle2}>
              <SimpleTable columns={coverageColumns} rows={data?.coverage?.cccAguas || []} limit={18} />
            </Panel>
            <Panel title="CCC Red Bull" sub="Clientes con compra Red Bull por promotor." icon={CheckCircle2}>
              <SimpleTable columns={coverageColumns} rows={data?.coverage?.cccRedBull || []} limit={18} />
            </Panel>
            <Panel title="CCC Marketplace" sub="Clientes con compra marketplace por promotor." icon={CheckCircle2}>
              <SimpleTable columns={coverageColumns} rows={data?.coverage?.cccMarketplace || []} limit={18} />
            </Panel>
            <Panel title="CCC por grupo producto" sub="Cobertura agrupada por producto estadístico." icon={Database}>
              <SimpleTable columns={[{ key: "label", label: "Grupo producto" }, { key: "clientes", label: "CCC", render: (v) => number(v, 0) }, { key: "hl", label: "HL", render: (v) => number(v) }, { key: "importeNeto", label: "Importe", render: (v) => money(v) }]} rows={data?.coverage?.byProduct || []} limit={28} />
            </Panel>
          </section>
        ) : null}

        {activeSheet === "brand" ? (
          <section className="wideGrid">
            <Panel title="SKUs por cliente" sub="Clientes con mayor cantidad de SKUs distintos." icon={Database}>
              <SimpleTable columns={[{ key: "label", label: "Cliente" }, { key: "skus", label: "SKUs", render: (v) => number(v, 0) }, { key: "clientes", label: "Clientes", render: (v) => number(v, 0) }, { key: "hl", label: "HL", render: (v) => number(v) }]} rows={data?.brandDistribution?.skusByClient || []} limit={24} />
            </Panel>
            <Panel title="Brand Distribution por promotor" sub="Total por promotor, marca y calibre." icon={BarChart3}>
              <section className="inlineMetrics">
                <Metric
                  title="SKUs activados"
                  value={number((data?.brandDistribution?.byPromotorNegocio || []).reduce((total, row) => total + (row.skus || 0), 0), 0)}
                  sub="Suma por promotor / negocio"
                />
              </section>
              <SimpleTable
                columns={[
                  { key: "promotor", label: "Promotor" },
                  { key: "negocio", label: "Negocio" },
                  { key: "skus", label: "SKUs", render: (v) => number(v, 0) },
                  { key: "clientes", label: "CCC", render: (v) => number(v, 0) },
                  { key: "hl", label: "HL", render: (v) => number(v) },
                  { key: "importeNeto", label: "Importe", render: (v) => money(v) }
                ]}
                rows={data?.brandDistribution?.byPromotorNegocio || []}
                limit={30}
              />
              <div className="spacer" />
              <SimpleTable
                columns={[
                  { key: "promotor", label: "Promotor" },
                  { key: "marca", label: "Marca" },
                  { key: "calibre", label: "Calibre" },
                  { key: "clientes", label: "CCC", render: (v) => number(v, 0) },
                  { key: "skus", label: "SKUs", render: (v) => number(v, 0) },
                  { key: "hl", label: "HL", render: (v) => number(v) },
                  { key: "importeNeto", label: "Importe", render: (v) => money(v) },
                  { key: "facturas", label: "Facturas", render: (v) => number(v, 0) }
                ]}
                rows={data?.brandDistribution?.byPromotorMarcaCalibre || []}
                limit={40}
              />
            </Panel>
          </section>
        ) : null}

        {activeSheet === "clientes" ? (
          <>
            <section className="metricsGrid">
              <Metric title="Acum. activos mes" value={number(data?.customerPurchases?.totalActivosMes, 0)} sub="Cliente único por marca/SKU filtrada" icon={CheckCircle2} />
              <Metric title="vs día anterior" value={number(data?.customerPurchases?.totalVsDiaAnterior, 0)} sub="Nuevos activos del último día filtrado" icon={RefreshCw} />
              <Metric title="Días con activación" value={number(data?.customerPurchases?.dailyTrend?.length, 0)} sub="Según rango Desde / Hasta" icon={CalendarDays} />
              <Metric title="Registros diarios" value={number(data?.customerPurchases?.detail?.length, 0)} sub="Cliente por día" icon={Database} />
            </section>
            <section className="wideGrid">
              <Panel title="Total de activaciones por promotor" sub="Cliente único activado en el mes. Si ya compró la marca/SKU filtrada, no vuelve a sumar." icon={CalendarDays}>
                <SimpleTable
                  columns={[
                    { key: "promotor", label: "Promotor" },
                    { key: "activosMes", label: "Acum. activos mes", render: (v) => number(v, 0) },
                    { key: "activacionesDia", label: "Activaciones día", render: (v) => number(v, 0) },
                    { key: "vsDiaAnterior", label: "Nuevos día", render: (v) => number(v, 0) },
                    { key: "clientes", label: "Clientes únicos", render: (v) => number(v, 0) },
                    { key: "hl", label: "HL", render: (v) => number(v) },
                    { key: "importeNeto", label: "Importe", render: (v) => money(v) },
                    { key: "facturas", label: "Facturas", render: (v) => number(v, 0) }
                  ]}
                  rows={data?.customerPurchases?.bySeller || []}
                  limit={40}
                />
              </Panel>
              <Panel title="Detalle de clientes con compra" sub="Filtrable por período, marca, SKU, promotor, cliente y calibre." icon={Search}>
                <div className="detailTools">
                  <button
                    className="secondaryButton"
                    type="button"
                    onClick={() =>
                      downloadDetail(data?.customerPurchases?.detail || [], [
                        "fecha",
                        "clienteCodigo",
                        "cliente",
                        "promotor",
                        "supervisor",
                        "marcas",
                        "calibres",
                        "skus",
                        "hl",
                        "importeNeto",
                        "facturas",
                        "comboProductos",
                        "combos"
                      ])
                    }
                  >
                    <Download size={16} />
                    Exportar
                  </button>
                </div>
                <SimpleTable
                  columns={[
                    { key: "fecha", label: "Fecha" },
                    { key: "cliente", label: "Cliente" },
                    { key: "promotor", label: "Promotor" },
                    { key: "supervisor", label: "Supervisor" },
                    { key: "marcas", label: "Marcas" },
                    { key: "calibres", label: "Calibres" },
                    { key: "skus", label: "SKUs", render: (v) => number(v, 0) },
                    { key: "hl", label: "HL", render: (v) => number(v) },
                    { key: "importeNeto", label: "Importe", render: (v) => money(v) },
                    { key: "facturas", label: "Facturas", render: (v) => number(v, 0) },
                    { key: "comboProductos", label: "Líneas combo", render: (v) => number(v, 0) },
                    { key: "combos", label: "Cant. combo", render: (v) => number(v, 0) }
                  ]}
                  rows={data?.customerPurchases?.detail || []}
                  limit={60}
                />
              </Panel>
            </section>
          </>
        ) : null}

        {activeSheet === "marketplace" ? (
          <Panel title="Marketplace" sub="GMV total, categoría, objetivo vs real, tendencia y CCC marketplace." icon={FileSpreadsheet}>
            <section className="inlineMetrics">
              <Metric title="GMV total" value={money(data?.marketplace?.gmvTotal)} sub="Detectado en ventadiaria" />
              <Metric title="CCC marketplace" value={number(data?.marketplace?.ccc?.[0]?.clientes || 0, 0)} sub="Requiere filas marketplace" />
            </section>
            <SimpleTable columns={sellerColumns} rows={data?.marketplace?.bySeller || []} limit={18} />
          </Panel>
        ) : null}

        {activeSheet === "combos" ? (
          <Panel title="Combos y focos" sub="Clientes combo, combo por tipo, ranking vendedor y acciones pendientes." icon={CheckCircle2}>
            <section className="inlineMetrics">
              <Metric title="Clientes combo" value={number(data?.combosFocus?.comboClients, 0)} sub="Artículo/producto combo" />
              <Metric title="Objetivo combos" value={data?.combosFocus?.comboObjective ? number(data.combosFocus.comboObjective, 0) : "Sin objetivo"} sub="Desde seguimiento mensual" />
              <Metric title="Tipos de combo" value={number(data?.combosFocus?.byComboCcc?.length, 0)} sub="Una fila por combo" />
            </section>
            <SimpleTable
              columns={[
                { key: "combo", label: "Combo" },
                { key: "clientes", label: "CCC", render: (v) => number(v, 0) },
                { key: "promotores", label: "Promotores", render: (v) => number(v, 0) },
                { key: "importeNeto", label: "Importe", render: (v) => money(v) },
                { key: "rows", label: "Líneas", render: (v) => number(v, 0) }
              ]}
              rows={data?.combosFocus?.byComboCcc || []}
              limit={30}
            />
            <div className="spacer" />
            <SimpleTable columns={sellerColumns} rows={data?.combosFocus?.bySeller || []} limit={18} />
          </Panel>
        ) : null}

        {activeSheet === "historico" ? (
          <MonthlyHistoryPanel closures={closures} data={data} onCloseMonth={closeMonth} closingMonth={closingMonth} />
        ) : null}

        {activeSheet === "detalle" ? (
          <Panel title="Detalle operativo" sub="Filtrable por vendedor, cliente, marca, calibre y grupo producto." icon={Search}>
            <div className="detailTools">
              <input value={detailSearch} onChange={(event) => setDetailSearch(event.target.value)} placeholder="Buscar en detalle..." />
              <button className="secondaryButton" type="button" onClick={() => downloadDetail(detailRows)}>
                <Download size={16} />
                Exportar
              </button>
            </div>
            <SimpleTable columns={[{ key: "fecha", label: "Fecha" }, { key: "supervisor", label: "Supervisor" }, { key: "vendedor", label: "Vendedor" }, { key: "cliente", label: "Cliente" }, { key: "marca", label: "Marca" }, { key: "calibre", label: "Calibre" }, { key: "productoEstadistico", label: "Grupo producto" }, { key: "hl", label: "HL", render: (v) => number(v) }]} rows={detailRows} limit={40} />
          </Panel>
        ) : null}

        {activeSheet === "calidad" ? (
          <Panel title="Calidad de datos / actualización" sub="Última actualización, archivo, registros, errores y alertas." icon={AlertCircle}>
            <SimpleTable columns={[{ key: "field", label: "Campo" }, { key: "rows", label: "Vacíos", render: (v) => number(v, 0) }]} rows={data?.quality?.missingValues || []} limit={12} />
            <div className="qualityBox">
              <p>Archivo: {data?.quality?.sourceFile || "ventadiaria.txt"}</p>
              <p>Registros cargados: {number(data?.quality?.loadedRows, 0)}</p>
              <p>Duplicados detectados: {number(data?.quality?.duplicates, 0)}</p>
              <p>Columnas faltantes: {(data?.quality?.missingHeaders || []).join(", ") || "Sin faltantes"}</p>
              <p>Filas incluidas por alcance: {number(data?.productScope?.includedRows, 0)}</p>
              <p>Filas excluidas por marca/negocio: {number(data?.productScope?.excludedRows, 0)}</p>
            </div>
            {(data?.unavailable || []).map((item) => (
              <div className="note" key={item}>{item}</div>
            ))}
          </Panel>
        ) : null}

        {activeSheet === "carga" ? <UploadPanel /> : null}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);

