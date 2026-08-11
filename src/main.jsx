import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  FileSpreadsheet,
  RefreshCw,
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

function Card({ title, value, sub, icon: Icon }) {
  return (
    <section className="metric">
      <div className="metricIcon">{Icon ? <Icon size={18} /> : null}</div>
      <div>
        <p>{title}</p>
        <strong>{value}</strong>
        {sub ? <span>{sub}</span> : null}
      </div>
    </section>
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
    const response = await fetch(`${API_URL}/api/monthly-focus`, {
      method: "POST",
      body
    });
    const payload = await response.json();
    setLoading(false);
    setStatus(response.ok ? { type: "ok", payload } : { type: "error", payload });
  }

  return (
    <section className="panel uploadPanel">
      <div className="panelHeader">
        <div>
          <h2>Carga mensual</h2>
          <p>Focos y objetivos del mes, guardados en Drive.</p>
        </div>
        <FileSpreadsheet size={22} />
      </div>
      <form onSubmit={submit}>
        <label>
          Mes
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
        <label className="fileInput">
          <UploadCloud size={18} />
          <span>{file ? file.name : "Seleccionar Excel"}</span>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
        </label>
        <button disabled={!file || loading} type="submit">
          {loading ? "Subiendo..." : "Guardar en Drive"}
        </button>
      </form>
      {status ? (
        <div className={`status ${status.type}`}>
          {status.type === "ok"
            ? `Guardado: ${status.payload.driveFile?.name || "archivo mensual"}`
            : status.payload.error}
        </div>
      ) : null}
    </section>
  );
}

function RankingTable({ rows }) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <h2>Ranking vendedores</h2>
          <p>Ordenado por HL acumulados.</p>
        </div>
        <BarChart3 size={22} />
      </div>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Vendedor</th>
              <th>HL</th>
              <th>Clientes</th>
              <th>Facturas</th>
              <th>Importe neto</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 14).map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{number(row.hl)}</td>
                <td>{number(row.clientes, 0)}</td>
                <td>{number(row.facturas, 0)}</td>
                <td>{money(row.importeNeto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/dashboard`);
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
    load();
  }, []);

  const byDay = useMemo(() => data?.byDay?.slice().reverse() || [], [data]);
  const byBrand = data?.byBrand?.slice(0, 12) || [];

  return (
    <main>
      <header className="topbar">
        <div>
          <h1>Dashboard Ventas Diarias</h1>
          <p>Fuente activa: ventadiaria.txt. Bultos excluido.</p>
        </div>
        <button className="iconButton" onClick={load} disabled={loading} title="Actualizar">
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

      <section className="metricsGrid">
        <Card title="HL acumulados" value={number(data?.totals?.hl)} sub={`${data?.totalRows || 0} registros`} icon={BarChart3} />
        <Card title="Importe neto" value={money(data?.totals?.importeNeto)} sub="Venta neta" icon={FileSpreadsheet} />
        <Card title="Clientes" value={number(data?.totals?.clientes, 0)} sub="Con compra" icon={CalendarDays} />
        <Card title="Facturas" value={number(data?.totals?.facturas, 0)} sub={`${data?.totals?.diasVenta || 0} dias con venta`} icon={RefreshCw} />
      </section>

      <section className="chartGrid">
        <section className="panel">
          <div className="panelHeader">
            <div>
              <h2>Evolucion diaria</h2>
              <p>HL por fecha del archivo actual.</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(value) => number(value, 0)} />
              <Tooltip formatter={(value) => number(value)} />
              <Line type="monotone" dataKey="hl" stroke="#0f766e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <h2>Marcas principales</h2>
              <p>Top 12 por HL.</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byBrand} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(value) => number(value, 0)} />
              <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => number(value)} />
              <Bar dataKey="hl" fill="#2563eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </section>

      <section className="lowerGrid">
        <RankingTable rows={data?.bySeller || []} />
        <UploadPanel />
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
