import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertCircle,
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
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:4100";

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
    <Panel title="Filtros" sub="Mes, fecha de corte, promotor, negocio, producto, marca, calibre, canal y cliente." icon={Filter}>
      <div className="filterGrid">
        <SelectFilter label="Mes" value={filters.mes} options={options.mes} onChange={(v) => update("mes", v)} />
        <SelectFilter label="Fecha" value={filters.fecha} options={options.fecha} onChange={(v) => update("fecha", v)} />
        <SelectFilter label="Promotor" value={filters.promotor} options={options.promotor} onChange={(v) => update("promotor", v)} />
        <SelectFilter label="Negocio" value={filters.negocio} options={options.negocio} onChange={(v) => update("negocio", v)} />
        <SelectFilter label="Grupo producto" value={filters.grupoProducto} options={options.grupoProducto} onChange={(v) => update("grupoProducto", v)} />
        <SelectFilter label="Marca" value={filters.marca} options={options.marca} onChange={(v) => update("marca", v)} />
        <SelectFilter label="Calibre" value={filters.calibre} options={options.calibre} onChange={(v) => update("calibre", v)} />
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
    const payload = await response.json();
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

function downloadDetail(rows) {
  const headers = ["fecha", "vendedor", "cliente", "marca", "calibre", "productoEstadistico", "negocio", "hl", "importeNeto", "facturas"];
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

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [detailSearch, setDetailSearch] = useState("");

  async function load(currentFilters = filters) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(Object.entries(currentFilters).filter(([, value]) => value));
      const response = await fetch(`${API_URL}/api/dashboard?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setData(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load({});
  }, []);

  const byDay = useMemo(() => data?.byDay || [], [data]);
  const detailRows = useMemo(() => {
    const term = detailSearch.toLowerCase();
    if (!term) return data?.operationalDetail || [];
    return (data?.operationalDetail || []).filter((row) =>
      [row.vendedor, row.cliente, row.marca, row.calibre, row.productoEstadistico, row.negocio].some((value) =>
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

  return (
    <main>
      <header className="topbar">
        <div>
          <h1>Dashboard Ventas Diarias</h1>
          <p>Fuente activa: ventadiaria.txt. Bultos excluido.</p>
        </div>
        <button className="iconButton" onClick={() => load()} disabled={loading} title="Actualizar">
          <RefreshCw size={18} />
          Actualizar
        </button>
      </header>

      {error ? (
        <section className="error">
          <AlertCircle size={18} />
          {error}
        </section>
      ) : null}

      <Filters data={data} filters={filters} setFilters={setFilters} refresh={() => load()} loading={loading} />

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

      <section className="chartGrid">
        <Panel title="Venta diaria" sub="Evolución de HL por día del mes." icon={CalendarDays}>
          <ResponsiveContainer width="100%" height={270}>
            <LineChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(value) => number(value, 0)} />
              <Tooltip formatter={(value) => number(value)} />
              <Line type="monotone" dataKey="hl" stroke="#0f766e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Volumen por negocio" sub="UNG, Aguas, Red Bull, TOP + NS, Vinos, Sidras, Gin." icon={BarChart3}>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={data?.byBusiness?.slice(0, 12) || []} layout="vertical" margin={{ left: 92 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(value) => number(value, 0)} />
              <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => number(value)} />
              <Bar dataKey="hl" fill="#2563eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </section>

      <section className="wideGrid">
        <Panel title="Seguimiento por promotor/vendedor" sub="Ranking HL, ranking CCC, avance, tendencia y faltante diario cuando existan objetivos." icon={BarChart3}>
          <SimpleTable columns={sellerColumns} rows={data?.bySeller || []} limit={18} />
        </Panel>
        <Panel title="Ranking CCC" sub="Clientes con compra por promotor." icon={CheckCircle2}>
          <SimpleTable columns={sellerColumns} rows={data?.bySellerCcc || []} limit={18} />
        </Panel>
      </section>

      <section className="wideGrid">
        <Panel title="Marca y calibre" sub="Pepsi, 7Up, Mirinda, Gatorade, H2Oh, Red Bull y calibres." icon={Database}>
          <SimpleTable columns={sellerColumns} rows={data?.byBrand || []} limit={12} />
          <div className="spacer" />
          <SimpleTable columns={sellerColumns} rows={data?.byCaliber || []} limit={12} />
        </Panel>
        <Panel title="Coberturas / CCC" sub="CCC UNG, aguas, Red Bull, marketplace y por grupo producto." icon={CheckCircle2}>
          <div className="miniTables">
            <SimpleTable columns={sellerColumns} rows={data?.coverage?.cccTotalUng || []} limit={6} />
            <SimpleTable columns={sellerColumns} rows={data?.coverage?.cccAguas || []} limit={6} />
            <SimpleTable columns={sellerColumns} rows={data?.coverage?.cccRedBull || []} limit={6} />
          </div>
        </Panel>
      </section>

      <section className="wideGrid">
        <Panel title="Brand Distribution / SKUs" sub="SKUs por cliente, distribución por grupo producto y activación por promotor." icon={Database}>
          <SimpleTable
            columns={[
              { key: "label", label: "Cliente / Grupo" },
              { key: "skus", label: "SKUs", render: (v) => number(v, 0) },
              { key: "clientes", label: "Clientes", render: (v) => number(v, 0) },
              { key: "hl", label: "HL", render: (v) => number(v) }
            ]}
            rows={data?.brandDistribution?.skusByClient || []}
            limit={14}
          />
        </Panel>
        <Panel title="Focos principales" sub="Tablero CCC UNG, Familiares, Non Sugar, Gatorade, Aguas." icon={BarChart3}>
          <SimpleTable columns={sellerColumns} rows={data?.brandDistribution?.focusGroups || []} limit={10} />
        </Panel>
      </section>

      <section className="wideGrid">
        <Panel title="Marketplace" sub="GMV total, categoría, objetivo vs real, tendencia y CCC marketplace." icon={FileSpreadsheet}>
          <section className="inlineMetrics">
            <Metric title="GMV total" value={money(data?.marketplace?.gmvTotal)} sub="Detectado en ventadiaria" />
            <Metric title="CCC marketplace" value={number(data?.marketplace?.ccc?.[0]?.clientes || 0, 0)} sub="Requiere filas marketplace" />
          </section>
          <SimpleTable columns={sellerColumns} rows={data?.marketplace?.bySeller || []} limit={10} />
        </Panel>
        <Panel title="Combos y focos" sub="Clientes combo, combo por tipo, ranking vendedor y acciones pendientes." icon={CheckCircle2}>
          <section className="inlineMetrics">
            <Metric title="Clientes combo" value={number(data?.combosFocus?.comboClients, 0)} sub="Cantidades en Combos" />
            <Metric title="Activaciones pendientes" value={number(data?.combosFocus?.pendingActivations?.length, 0)} sub="Desde Excel mensual" />
          </section>
          <SimpleTable columns={sellerColumns} rows={data?.combosFocus?.bySeller || []} limit={10} />
        </Panel>
      </section>

      <section className="wideGrid">
        <Panel title="Detalle operativo" sub="Filtrable por vendedor, cliente, marca, calibre y grupo producto." icon={Search}>
          <div className="detailTools">
            <input value={detailSearch} onChange={(event) => setDetailSearch(event.target.value)} placeholder="Buscar en detalle..." />
            <button className="secondaryButton" type="button" onClick={() => downloadDetail(detailRows)}>
              <Download size={16} />
              Exportar
            </button>
          </div>
          <SimpleTable
            columns={[
              { key: "fecha", label: "Fecha" },
              { key: "vendedor", label: "Vendedor" },
              { key: "cliente", label: "Cliente" },
              { key: "marca", label: "Marca" },
              { key: "calibre", label: "Calibre" },
              { key: "productoEstadistico", label: "Grupo producto" },
              { key: "hl", label: "HL", render: (v) => number(v) }
            ]}
            rows={detailRows}
            limit={25}
          />
        </Panel>
        <Panel title="Calidad de datos / actualización" sub="Última actualización, archivo, registros, errores y alertas." icon={AlertCircle}>
          <SimpleTable
            columns={[
              { key: "field", label: "Campo" },
              { key: "rows", label: "Vacíos", render: (v) => number(v, 0) }
            ]}
            rows={data?.quality?.missingValues || []}
            limit={12}
          />
          <div className="qualityBox">
            <p>Archivo: {data?.quality?.sourceFile || "ventadiaria.txt"}</p>
            <p>Registros cargados: {number(data?.quality?.loadedRows, 0)}</p>
            <p>Duplicados detectados: {number(data?.quality?.duplicates, 0)}</p>
            <p>Columnas faltantes: {(data?.quality?.missingHeaders || []).join(", ") || "Sin faltantes"}</p>
          </div>
          {(data?.unavailable || []).map((item) => (
            <div className="note" key={item}>
              {item}
            </div>
          ))}
        </Panel>
      </section>

      <UploadPanel />
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
