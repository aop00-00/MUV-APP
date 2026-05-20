// app/routes/admin/finanzas.tsx
import { useState } from "react";
import type { Route } from "./+types/finanzas";
import {
    Download,
    TrendingUp,
    Wallet,
    CreditCard,
    PieChart,
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    DollarSign,
    Calendar,
    Briefcase,
    ShoppingBag,
    X,
    Info
} from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
    const { requirePlanAccess } = await import("~/services/plan-access.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requirePlanAccess(request, "/admin/finanzas");
    const now = new Date();
    const currentMonth = now.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const daysElapsed = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    // 1. ORDENES
    const { data: orders } = await supabaseAdmin.from("orders").select("id, total, status, customer_name, created_at, payment_method").eq("gym_id", gymId).gte("created_at", monthStart).lte("created_at", monthEnd).order("created_at", { ascending: false });
    const paidOrders = (orders ?? []).filter((o: any) => o.status === "paid");
    const revenue = paidOrders.reduce((s: number, o: any) => s + Number(o.total), 0);
    const packagesSold = paidOrders.length;
    const pendingRevenue = (orders ?? []).filter((o: any) => o.status === "pending").reduce((s: number, o: any) => s + Number(o.total), 0);
    const avgTicket = packagesSold > 0 ? Math.round(revenue / packagesSold) : 0;
    const revenueProjection = daysElapsed > 0 ? Math.round((revenue / daysElapsed) * daysInMonth) : 0;
    const byMethod: Record<string, number> = {};
    paidOrders.forEach((o: any) => { const m = o.payment_method || "otro"; byMethod[m] = (byMethod[m] || 0) + Number(o.total); });
    const revenueByMethod = Object.entries(byMethod).map(([method, amount]) => ({ method, amount })).sort((a: any, b: any) => b.amount - a.amount);
    // 2. NOMINA
    const { data: coaches } = await supabaseAdmin.from("coaches").select("id, name, rate_per_session").eq("gym_id", gymId).eq("is_active", true);
    const { data: completedClasses } = await supabaseAdmin.from("classes").select("coach_id, id, capacity").eq("gym_id", gymId).gte("start_time", monthStart).lte("start_time", monthEnd);
    const sessionCount: Record<string, number> = {};
    for (const cls of (completedClasses ?? [])) { if (cls.coach_id) sessionCount[cls.coach_id] = (sessionCount[cls.coach_id] || 0) + 1; }
    const { data: payrolls } = await supabaseAdmin.from("coach_payroll").select("coach_id, is_paid, bonus, total").eq("gym_id", gymId).eq("period", `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    const payrollMap = new Map((payrolls ?? []).map((p: any) => [p.coach_id, p]));
    let totalPayroll = 0;
    const coachStats = (coaches ?? []).map((c: any) => { const sessions = sessionCount[c.id] || 0; const pr: any = payrollMap.get(c.id); const subtotal = (sessions * (c.rate_per_session || 200)) + (pr?.bonus || 0); totalPayroll += subtotal; return { name: c.name, sessions, subtotal }; }).sort((a: any, b: any) => b.subtotal - a.subtotal).slice(0, 5);
    // 3. GASTOS
    let totalExpenses = 0;
    const { data: expensesList, error: expensesError } = await supabaseAdmin.from("expenses").select("amount, title, created_at").eq("gym_id", gymId).gte("created_at", monthStart).lte("created_at", monthEnd);
    if (!expensesError && expensesList) totalExpenses = expensesList.reduce((s: number, e: any) => s + Number(e.amount), 0);
    const netProfit = revenue - totalPayroll - totalExpenses;
    // 4. MRR + MEMBRESIAS
    const { data: memberships } = await supabaseAdmin.from("memberships").select("id, status, price, plan_name, end_date").eq("gym_id", gymId);
    const activeMem = (memberships ?? []).filter((m: any) => m.status === "active");
    const mrr = activeMem.reduce((s: number, m: any) => s + Number(m.price || 0), 0);
    const todayStr = now.toISOString().split("T")[0];
    const in7 = new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0];
    const planMap: Record<string, { count: number; revenue: number }> = {};
    activeMem.forEach((m: any) => { const n = m.plan_name || "Sin plan"; if (!planMap[n]) planMap[n] = { count: 0, revenue: 0 }; planMap[n].count++; planMap[n].revenue += Number(m.price || 0); });
    const topPlans = Object.entries(planMap).map(([name, d]) => ({ name, count: d.count, revenue: d.revenue })).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5);
    const membershipStats = { active: activeMem.length, frozen: (memberships ?? []).filter((m: any) => m.status === "frozen").length, expired: (memberships ?? []).filter((m: any) => m.status === "expired").length, cancelled: (memberships ?? []).filter((m: any) => m.status === "cancelled").length, expiringSoon: activeMem.filter((m: any) => m.end_date && m.end_date >= todayStr && m.end_date <= in7).length };
    // 5. NUEVOS CLIENTES
    const { data: newProfiles } = await supabaseAdmin.from("profiles").select("id").eq("gym_id", gymId).gte("created_at", monthStart).lte("created_at", monthEnd);
    const newCustomers = (newProfiles ?? []).length;
    // 6. ASISTENCIA
    const classIds = (completedClasses ?? []).map((c: any) => c.id);
    let attendanceRate = 0, occupancyRate = 0, totalBookings = 0, completedBookings = 0;
    if (classIds.length > 0) { const { data: bookings } = await supabaseAdmin.from("bookings").select("status").in("class_id", classIds.slice(0, 500)); totalBookings = (bookings ?? []).length; completedBookings = (bookings ?? []).filter((b: any) => b.status === "completed").length; attendanceRate = totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 0; const totalCap = (completedClasses ?? []).reduce((s: number, c: any) => s + (c.capacity || 0), 0); occupancyRate = totalCap > 0 ? Math.round((totalBookings / totalCap) * 100) : 0; }
    // 7. CRM
    const { data: leads } = await supabaseAdmin.from("leads").select("stage, created_at").eq("gym_id", gymId);
    const totalLeads = (leads ?? []).length;
    const convertedLeads = (leads ?? []).filter((l: any) => l.stage === "converted").length;
    const crmStats = { totalLeads, convertedLeads, leadConversionRate: totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0, newLeadsThisMonth: (leads ?? []).filter((l: any) => l.created_at >= monthStart).length };
    // 8b. MARGEN BRUTO POS (order_items + products.cost)
    let posRevenue = 0, posCost = 0;
    const paidOrderIds = paidOrders.map((o: any) => o.id);
    if (paidOrderIds.length > 0) {
        const { data: orderItems } = await supabaseAdmin
            .from("order_items")
            .select("quantity, unit_price, product_id")
            .in("order_id", paidOrderIds);
        if (orderItems && orderItems.length > 0) {
            const productIds = [...new Set(orderItems.map((i: any) => i.product_id).filter(Boolean))];
            const { data: productCosts } = productIds.length > 0
                ? await supabaseAdmin.from("products").select("id, cost").in("id", productIds)
                : { data: [] };
            const costMap = new Map((productCosts ?? []).map((p: any) => [p.id, Number(p.cost ?? 0)]));
            for (const item of orderItems) {
                const qty = Number(item.quantity ?? 1);
                const unitPrice = Number(item.unit_price ?? 0);
                const unitCost = costMap.get(item.product_id) ?? 0;
                posRevenue += unitPrice * qty;
                posCost += unitCost * qty;
            }
        }
    }
    const posGrossMargin = posRevenue > 0 ? Math.round(((posRevenue - posCost) / posRevenue) * 100) : 0;

    // 8. FITCOINS
    let fitcoinsIssued = 0, fitcoinsRedeemed = 0;
    const { data: fitcoinTx } = await supabaseAdmin.from("fitcoin_transactions").select("amount").eq("gym_id", gymId).gte("created_at", monthStart).lte("created_at", monthEnd);
    (fitcoinTx ?? []).forEach((tx: any) => { if (Number(tx.amount) > 0) fitcoinsIssued += Number(tx.amount); else fitcoinsRedeemed += Math.abs(Number(tx.amount)); });
    // 9. CHART
    const chartData = [{ label: "Sem 1", income: 0, expense: 0 }, { label: "Sem 2", income: 0, expense: 0 }, { label: "Sem 3", income: 0, expense: 0 }, { label: "Sem 4", income: 0, expense: 0 }];
    paidOrders.forEach((o: any) => { const w = Math.min(3, Math.floor((new Date(o.created_at).getDate() - 1) / 7)); chartData[w].income += Number(o.total); });
    chartData[3].expense += totalPayroll + totalExpenses;
    // 10. TRANSACCIONES
    const recentTransactions: any[] = [
        ...paidOrders.slice(0, 8).map((o: any) => ({ id: o.id, type: "income", title: `Venta - ${o.customer_name || "Cliente"}`, amount: Number(o.total), date: new Date(o.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }), status: "Completado" })),
        ...(payrolls ?? []).filter((p: any) => p.is_paid).map((p: any) => { const c = coaches?.find((x: any) => x.id === p.coach_id); return { id: `pay-${p.coach_id}`, type: "expense", title: `Nomina - ${(c as any)?.name || "Coach"}`, amount: Number(p.total || 0), date: "Periodo Actual", status: "Pagado" }; }),
        ...(!expensesError && expensesList ? expensesList.map((e: any) => ({ id: `exp-${Math.random()}`, type: "expense", title: e.title || "Gasto", amount: Number(e.amount), date: new Date(e.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" }), status: "Pagado" })) : []),
    ].slice(0, 15);
    return { currentMonth, daysElapsed, daysInMonth, metrics: { revenue, expenses: totalExpenses, payroll: totalPayroll, netProfit, packagesSold, mrr, avgTicket, revenueProjection, pendingRevenue, newCustomers }, posMarginStats: { posRevenue, posCost, posGrossMargin }, membershipStats, attendanceStats: { attendanceRate, occupancyRate, totalBookings, completedBookings }, crmStats, fitcoinsStats: { issued: fitcoinsIssued, redeemed: fitcoinsRedeemed }, revenueByMethod, topPlans, coachStats, recentTransactions, chartData };
}


type CardInfo = { title: string; description: string; formula: string; context: string };

export default function FinanzasDashboard({ loaderData }: Route.ComponentProps) {
    const { currentMonth, daysElapsed, daysInMonth, metrics, posMarginStats, membershipStats, attendanceStats, crmStats, fitcoinsStats, revenueByMethod, topPlans, coachStats, recentTransactions, chartData } = loaderData;
    const maxChartValue = Math.max(1, ...chartData.map((d: any) => Math.max(d.income, d.expense)));
    const [activeInfo, setActiveInfo] = useState<CardInfo | null>(null);

    const fmt = (n: number) => "$" + n.toLocaleString("es-MX");

    const cardInfos: Record<string, CardInfo> = {
        ingresos: {
            title: "Ingresos del Mes",
            description: "Total facturado y efectivamente cobrado durante el mes en curso. Solo incluye órdenes con pago confirmado — excluye pendientes y canceladas.",
            formula: "Σ órdenes con status = 'paid'",
            context: `Este mes (${currentMonth}) se cerraron ${metrics.packagesSold} venta${metrics.packagesSold !== 1 ? "s" : ""} pagada${metrics.packagesSold !== 1 ? "s" : ""} que suman ${fmt(metrics.revenue)}. Día ${daysElapsed} de ${daysInMonth}.`,
        },
        mrr: {
            title: "MRR — Ingresos Recurrentes",
            description: "Monthly Recurring Revenue: la suma del precio de todas las membresías activas. Representa el ingreso base predecible antes de ventas adicionales.",
            formula: "Σ precio de membresías con status = 'active'",
            context: `Tienes ${membershipStats.active} membresía${membershipStats.active !== 1 ? "s" : ""} activa${membershipStats.active !== 1 ? "s" : ""} con un valor total de ${fmt(metrics.mrr)}. Promedio por membresía: ${membershipStats.active > 0 ? fmt(Math.round(metrics.mrr / membershipStats.active)) : "$0"}.`,
        },
        ticket: {
            title: "Ticket Promedio",
            description: "Valor promedio de cada transacción pagada en el mes. Sirve para medir el impacto de cambios de precios o de mix de productos.",
            formula: "Ingresos ÷ número de ventas pagadas",
            context: `${fmt(metrics.revenue)} ingresos ÷ ${metrics.packagesSold} venta${metrics.packagesSold !== 1 ? "s" : ""} = ${fmt(metrics.avgTicket)} por transacción.${metrics.packagesSold === 0 ? " Sin ventas aún este mes." : ""}`,
        },
        proyeccion: {
            title: "Proyección al Cierre",
            description: "Estimación de cuánto cerrarás el mes si el ritmo de ventas actual se mantiene constante hasta el último día.",
            formula: "(Ingresos ÷ días transcurridos) × días totales del mes",
            context: `A día ${daysElapsed} de ${daysInMonth} con ${fmt(metrics.revenue)} de ingresos, se proyectan ${fmt(metrics.revenueProjection)} al cierre de ${currentMonth}.`,
        },
        ganancia: {
            title: "Ganancia Neta",
            description: "Lo que realmente queda después de cubrir nómina de coaches y demás gastos operativos. Es la utilidad real del período.",
            formula: "Ingresos − Nómina − Otros Gastos",
            context: `${fmt(metrics.revenue)} − ${fmt(metrics.payroll)} (nómina) − ${fmt(metrics.expenses)} (gastos) = ${fmt(metrics.netProfit)}.${metrics.netProfit < 0 ? ` Estás en pérdida de ${fmt(Math.abs(metrics.netProfit))} este mes.` : " Operando con utilidad positiva."}`,
        },
        nomina: {
            title: "Nómina de Coaches",
            description: "Total estimado a pagar a coaches activos: sesiones impartidas × su tarifa por sesión, más cualquier bono registrado.",
            formula: "Σ (sesiones del coach × tarifa) + bonos",
            context: `La nómina acumulada de ${currentMonth} es ${fmt(metrics.payroll)}, representando el ${metrics.revenue > 0 ? Math.round((metrics.payroll / metrics.revenue) * 100) : 0}% de los ingresos.${coachStats.length > 0 ? ` Coach con mayor costo: ${coachStats[0].name} (${fmt(coachStats[0].subtotal)}).` : ""}`,
        },
        gastos: {
            title: "Otros Gastos",
            description: "Gastos operativos registrados manualmente en el período, excluyendo nómina. Renta, servicios, insumos, mantenimiento, etc.",
            formula: "Σ registros en tabla 'expenses' del mes",
            context: metrics.expenses === 0
                ? `No hay gastos adicionales registrados en ${currentMonth}. Si tienes gastos operativos, recuerda registrarlos para que la Ganancia Neta sea precisa.`
                : `Se registraron ${fmt(metrics.expenses)} en gastos adicionales durante ${currentMonth}.`,
        },
        pendiente: {
            title: "Cobro Pendiente",
            description: "Órdenes creadas este mes que aún no han sido pagadas. Representan ingresos por cobrar, no confirmados.",
            formula: "Σ órdenes con status = 'pending'",
            context: metrics.pendingRevenue === 0
                ? `No hay órdenes pendientes de cobro en ${currentMonth}. Todas las órdenes están liquidadas o canceladas.`
                : `Tienes ${fmt(metrics.pendingRevenue)} sin cobrar. Si se liquidan, los ingresos totales del mes subirían a ${fmt(metrics.revenue + metrics.pendingRevenue)}.`,
        },
        clientes: {
            title: "Nuevos Clientes",
            description: "Perfiles de usuarios creados en el sistema durante el mes actual. Indica el ritmo de captación de nuevos miembros.",
            formula: "Σ perfiles con created_at en el mes actual",
            context: `${metrics.newCustomers} cliente${metrics.newCustomers !== 1 ? "s" : ""} nuevo${metrics.newCustomers !== 1 ? "s" : ""} registrado${metrics.newCustomers !== 1 ? "s" : ""} en ${currentMonth}. Ritmo promedio: ${daysElapsed > 0 ? (metrics.newCustomers / daysElapsed).toFixed(1) : "0"} por día.`,
        },
    };

    const exportToCSV = () => {
        const rows = [
            ["Reporte Financiero"], ["Mes", currentMonth], [""],
            ["METRICAS GENERALES"],
            ["Ingresos", "$" + metrics.revenue], ["MRR", "$" + metrics.mrr],
            ["Ticket Promedio", "$" + metrics.avgTicket], ["Proyeccion Mes", "$" + metrics.revenueProjection],
            ["Pendiente Cobro", "$" + metrics.pendingRevenue],
            ["Nomina", "$" + metrics.payroll], ["Gastos", "$" + metrics.expenses], ["Ganancia Neta", "$" + metrics.netProfit],
            [""], ["MARGEN POS"],
            ["Ingresos POS", "$" + posMarginStats.posRevenue], ["Costo Productos", "$" + posMarginStats.posCost], ["Margen Bruto", posMarginStats.posGrossMargin + "%"],
            [""], ["MEMBRESIAS"],
            ["Activas", membershipStats.active], ["Congeladas", membershipStats.frozen], ["Vencidas", membershipStats.expired],
            ["Por vencer (7d)", membershipStats.expiringSoon], ["Nuevos Clientes", metrics.newCustomers],
            [""], ["ASISTENCIA"],
            ["Tasa Asistencia", attendanceStats.attendanceRate + "%"], ["Ocupacion", attendanceStats.occupancyRate + "%"],
            [""], ["CRM"],
            ["Leads Totales", crmStats.totalLeads], ["Convertidos", crmStats.convertedLeads], ["Tasa Conv.", crmStats.leadConversionRate + "%"],
            [""], ["TRANSACCIONES"], ["Tipo","Descripcion","Monto","Fecha","Estado"],
            ...recentTransactions.map((t: any) => [t.type === "income" ? "Ingreso" : "Gasto", t.title, "$" + t.amount, t.date, t.status]),
        ];
        const csv = "\uFEFF" + rows.map(r => r.join(",")).join("\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
        a.download = "finanzas_" + currentMonth.replace(/\s+/g, "_") + ".csv";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    const pct = (a: number, b: number) => b > 0 ? Math.max(0, Math.min(100, Math.round((a / b) * 100))) : 0;

    return (
        <>
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <PieChart className="w-8 h-8 text-amber-400" />Finanzas Globales
                    </h1>
                    <p className="text-white/50 text-sm mt-1">Vista integral del rendimiento financiero. Datos en tiempo real.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-white/5 rounded-xl border border-white/10 text-white/70 text-sm font-medium">
                        <Calendar className="w-4 h-4" /><span className="capitalize">{currentMonth}</span>
                    </div>
                    <button onClick={exportToCSV} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-xl text-sm font-black transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:-translate-y-0.5">
                        <Download className="w-4 h-4" /> Exportar Excel
                    </button>
                </div>
            </div>

            {/* KPIs Row 1: Revenue */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <MetricCard title="Ingresos" value={metrics.revenue} icon={TrendingUp} color="text-green-400" bg="bg-green-400/10" border="border-green-400/20" info={cardInfos.ingresos} onInfoClick={setActiveInfo} />
                <MetricCard title="MRR" value={metrics.mrr} icon={DollarSign} color="text-violet-400" bg="bg-violet-400/10" border="border-violet-400/20" info={cardInfos.mrr} onInfoClick={setActiveInfo} />
                <MetricCard title="Ticket Prom." value={metrics.avgTicket} icon={CreditCard} color="text-blue-400" bg="bg-blue-400/10" border="border-blue-400/20" info={cardInfos.ticket} onInfoClick={setActiveInfo} />
                <MetricCard title="Proyección" value={metrics.revenueProjection} icon={Activity} color="text-cyan-400" bg="bg-cyan-400/10" border="border-cyan-400/20" info={cardInfos.proyeccion} onInfoClick={setActiveInfo} />
                <MetricCard title="Ganancia Neta" value={metrics.netProfit} icon={Briefcase} color="text-amber-400" bg="bg-amber-400/10" border="border-amber-400/20" info={cardInfos.ganancia} onInfoClick={setActiveInfo} />
            </div>

            {/* KPIs Row 2: Costs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard title="Nómina" value={metrics.payroll} icon={Wallet} color="text-red-400" bg="bg-red-400/10" border="border-red-400/20" info={cardInfos.nomina} onInfoClick={setActiveInfo} />
                <MetricCard title="Otros Gastos" value={metrics.expenses} icon={Wallet} color="text-orange-400" bg="bg-orange-400/10" border="border-orange-400/20" info={cardInfos.gastos} onInfoClick={setActiveInfo} />
                <MetricCard title="Cobro Pendiente" value={metrics.pendingRevenue} icon={DollarSign} color="text-yellow-400" bg="bg-yellow-400/10" border="border-yellow-400/20" info={cardInfos.pendiente} onInfoClick={setActiveInfo} />
                <MetricCard title="Nuevos Clientes" value={metrics.newCustomers} icon={TrendingUp} color="text-green-400" bg="bg-green-400/10" border="border-green-400/20" isCurrency={false} info={cardInfos.clientes} onInfoClick={setActiveInfo} />
            </div>

            {/* Margen Bruto POS */}
            {posMarginStats.posRevenue > 0 && (
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6">
                    <h2 className="font-bold text-white mb-5 flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-emerald-400" />
                        Margen Bruto — Productos POS
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
                            <p className="text-white/50 text-xs font-medium mb-1 uppercase tracking-wider">Ingresos POS</p>
                            <p className="text-emerald-400 font-black text-2xl">{fmt(posMarginStats.posRevenue)}</p>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                            <p className="text-white/50 text-xs font-medium mb-1 uppercase tracking-wider">Costo de Productos</p>
                            <p className="text-red-400 font-black text-2xl">{fmt(posMarginStats.posCost)}</p>
                        </div>
                        <div className={`rounded-2xl p-4 border ${posMarginStats.posGrossMargin >= 40 ? "bg-green-500/10 border-green-500/20" : posMarginStats.posGrossMargin >= 20 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                            <p className="text-white/50 text-xs font-medium mb-1 uppercase tracking-wider">Margen Bruto</p>
                            <p className={`font-black text-2xl ${posMarginStats.posGrossMargin >= 40 ? "text-green-400" : posMarginStats.posGrossMargin >= 20 ? "text-amber-400" : "text-red-400"}`}>
                                {posMarginStats.posGrossMargin}%
                            </p>
                            <div className="mt-2 h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ${posMarginStats.posGrossMargin >= 40 ? "bg-green-400" : posMarginStats.posGrossMargin >= 20 ? "bg-amber-400" : "bg-red-400"}`}
                                    style={{ width: `${Math.min(100, posMarginStats.posGrossMargin)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Chart + Salud */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-lg font-bold text-white">Flujo de Efectivo</h2>
                            <p className="text-white/50 text-xs mt-1">Ingresos vs Gastos/Nómina por semana</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-medium">
                            <div className="flex items-center gap-1.5 text-white/70"><div className="w-3 h-3 rounded-full bg-green-400/80" /> Ingresos</div>
                            <div className="flex items-center gap-1.5 text-white/70"><div className="w-3 h-3 rounded-full bg-red-400/80" /> Gastos</div>
                        </div>
                    </div>
                    <div className="flex-1 flex items-end gap-6 sm:gap-12 mt-4 min-h-[200px]">
                        {chartData.map((data: any, i: number) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                                <div className="w-full flex justify-center items-end gap-2 h-48 relative">
                                    <div className="w-1/2 max-w-[2rem] bg-gradient-to-t from-green-500/20 to-green-400/80 rounded-t-md relative group-hover:to-green-400 transition-all duration-300" style={{ height: `${maxChartValue > 0 ? (data.income / maxChartValue) * 100 : 0}%` }}>
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 text-white text-[10px] py-1 px-2 rounded font-bold whitespace-nowrap">${data.income.toLocaleString()}</div>
                                    </div>
                                    <div className="w-1/2 max-w-[2rem] bg-gradient-to-t from-red-500/20 to-red-400/80 rounded-t-md relative group-hover:to-red-400 transition-all duration-300" style={{ height: `${maxChartValue > 0 ? (data.expense / maxChartValue) * 100 : 0}%` }}>
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 text-white text-[10px] py-1 px-2 rounded font-bold whitespace-nowrap">${data.expense.toLocaleString()}</div>
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-white/40 uppercase tracking-wider">{data.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-gradient-to-br from-amber-500/10 to-amber-900/10 backdrop-blur-xl border border-amber-500/20 rounded-3xl p-6 relative overflow-hidden">
                    <Activity className="absolute right-4 bottom-4 w-32 h-32 text-amber-500/5 pointer-events-none" />
                    <h3 className="text-amber-400 font-bold mb-4">Salud del Negocio</h3>
                    <div className="space-y-4">
                        {[
                            { label: "Margen Operativo", val: pct(metrics.netProfit, metrics.revenue), color: "bg-amber-400" },
                            { label: "Gasto Nómina", val: pct(metrics.payroll, metrics.revenue), color: "bg-blue-400" },
                            { label: "Tasa Asistencia", val: attendanceStats.attendanceRate, color: "bg-green-400" },
                            { label: "Ocupación Clases", val: attendanceStats.occupancyRate, color: "bg-violet-400" },
                            { label: "Conv. CRM", val: crmStats.leadConversionRate, color: "bg-pink-400" },
                        ].map(item => (
                            <div key={item.label}>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-white/60">{item.label}</span>
                                    <span className="text-white font-bold">{item.val}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                                    <div className={`h-full ${item.color} transition-all duration-700`} style={{ width: `${item.val}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Membresías + Ingresos por método */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Estado de Membresías */}
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6">
                    <h2 className="font-bold text-white mb-5 flex items-center gap-2"><CreditCard className="w-4 h-4 text-blue-400" />Estado de Membresías</h2>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: "Activas", val: membershipStats.active, color: "text-green-400", bg: "bg-green-500/10" },
                            { label: "Congeladas", val: membershipStats.frozen, color: "text-cyan-400", bg: "bg-cyan-500/10" },
                            { label: "Vencidas", val: membershipStats.expired, color: "text-red-400", bg: "bg-red-500/10" },
                            { label: "Canceladas", val: membershipStats.cancelled, color: "text-white/40", bg: "bg-white/5" },
                        ].map(s => (
                            <div key={s.label} className={`${s.bg} rounded-2xl p-4`}>
                                <p className="text-white/50 text-xs font-medium mb-1">{s.label}</p>
                                <p className={`text-3xl font-black ${s.color}`}>{s.val}</p>
                            </div>
                        ))}
                    </div>
                    {membershipStats.expiringSoon > 0 && (
                        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                            <p className="text-amber-300 text-sm font-semibold">{membershipStats.expiringSoon} membresía(s) vencen en los próximos 7 días</p>
                        </div>
                    )}
                </div>

                {/* Ingresos por método de pago */}
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6">
                    <h2 className="font-bold text-white mb-5 flex items-center gap-2"><Wallet className="w-4 h-4 text-violet-400" />Ingresos por Método de Pago</h2>
                    {revenueByMethod.length === 0 ? (
                        <p className="text-white/30 text-sm text-center py-8">Sin datos de métodos de pago</p>
                    ) : (
                        <div className="space-y-3">
                            {revenueByMethod.map((m: any) => (
                                <div key={m.method}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-white/70 capitalize font-medium">{m.method.replace("_", " ")}</span>
                                        <span className="text-white font-black">{fmt(m.amount)}</span>
                                    </div>
                                    <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
                                        <div className="h-full bg-violet-400 rounded-full" style={{ width: `${metrics.revenue > 0 ? (m.amount / metrics.revenue) * 100 : 0}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Top Planes + Coaches + CRM + FitCoins */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Top Planes */}
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6">
                    <h2 className="font-bold text-white mb-4 text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-400" />Top Planes</h2>
                    {topPlans.length === 0 ? <p className="text-white/30 text-xs text-center py-4">Sin datos</p> : (
                        <div className="space-y-3">
                            {topPlans.map((p: any, i: number) => (
                                <div key={p.name} className="flex items-center gap-3">
                                    <span className="text-xs font-black text-white/30 w-4">{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-xs font-semibold truncate">{p.name}</p>
                                        <p className="text-white/40 text-[10px]">{p.count} membresía(s)</p>
                                    </div>
                                    <span className="text-green-400 text-xs font-black">{fmt(p.revenue)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Top Coaches */}
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6">
                    <h2 className="font-bold text-white mb-4 text-sm flex items-center gap-2"><Briefcase className="w-4 h-4 text-blue-400" />Coaches (Nómina)</h2>
                    {coachStats.length === 0 ? <p className="text-white/30 text-xs text-center py-4">Sin datos</p> : (
                        <div className="space-y-3">
                            {coachStats.map((c: any, i: number) => (
                                <div key={c.name} className="flex items-center gap-3">
                                    <span className="text-xs font-black text-white/30 w-4">{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-xs font-semibold truncate">{c.name}</p>
                                        <p className="text-white/40 text-[10px]">{c.sessions} sesiones</p>
                                    </div>
                                    <span className="text-red-400 text-xs font-black">{fmt(c.subtotal)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* CRM Stats */}
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6">
                    <h2 className="font-bold text-white mb-4 text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-pink-400" />CRM / Leads</h2>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-white/50 text-xs">Leads Totales</span>
                            <span className="text-white font-black text-sm">{crmStats.totalLeads}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-white/50 text-xs">Convertidos</span>
                            <span className="text-green-400 font-black text-sm">{crmStats.convertedLeads}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-white/50 text-xs">Nuevos este mes</span>
                            <span className="text-blue-400 font-black text-sm">{crmStats.newLeadsThisMonth}</span>
                        </div>
                        <div className="pt-2 border-t border-white/5">
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-white/60">Tasa Conversión</span>
                                <span className="text-white font-bold">{crmStats.leadConversionRate}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                                <div className="h-full bg-pink-400" style={{ width: `${crmStats.leadConversionRate}%` }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* FitCoins */}
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6">
                    <h2 className="font-bold text-white mb-4 text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-amber-400" />FitCoins (Mes)</h2>
                    <div className="space-y-4">
                        <div className="bg-amber-500/10 rounded-xl p-3">
                            <p className="text-white/50 text-[10px] uppercase tracking-wider mb-1">Emitidos</p>
                            <p className="text-amber-400 font-black text-2xl">{fitcoinsStats.issued.toLocaleString()}</p>
                        </div>
                        <div className="bg-red-500/10 rounded-xl p-3">
                            <p className="text-white/50 text-[10px] uppercase tracking-wider mb-1">Canjeados</p>
                            <p className="text-red-400 font-black text-2xl">{fitcoinsStats.redeemed.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3">
                            <p className="text-white/50 text-[10px] uppercase tracking-wider mb-1">Balance Neto</p>
                            <p className="text-white font-black text-xl">{(fitcoinsStats.issued - fitcoinsStats.redeemed).toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Asistencia Stats */}
            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6">
                <h2 className="font-bold text-white mb-5 flex items-center gap-2"><Activity className="w-4 h-4 text-green-400" />Asistencia y Ocupación</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: "Total Reservas", val: attendanceStats.totalBookings, color: "text-white", suffix: "" },
                        { label: "Asistieron", val: attendanceStats.completedBookings, color: "text-green-400", suffix: "" },
                        { label: "Tasa Asistencia", val: attendanceStats.attendanceRate, color: "text-blue-400", suffix: "%" },
                        { label: "Ocupación Prom.", val: attendanceStats.occupancyRate, color: "text-violet-400", suffix: "%" },
                    ].map(s => (
                        <div key={s.label} className="bg-white/5 rounded-2xl p-4 text-center">
                            <p className="text-white/40 text-xs font-medium mb-1">{s.label}</p>
                            <p className={`text-3xl font-black ${s.color}`}>{s.val}{s.suffix}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Transacciones Recientes */}
            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-3xl overflow-hidden">
                <div className="px-6 py-5 border-b border-white/5">
                    <h2 className="font-bold text-white">Transacciones y Movimientos</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-white/5 border-b border-white/5">
                            <tr>
                                {["Concepto", "Fecha", "Estado", "Monto"].map(h => (
                                    <th key={h} className="text-left text-xs font-semibold text-white/40 uppercase tracking-wider px-6 py-4">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {recentTransactions.map((t: any) => (
                                <tr key={t.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${t.type === "income" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                                                {t.type === "income" ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                                            </div>
                                            <span className="font-semibold text-white">{t.title}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-white/50">{t.date}</td>
                                    <td className="px-6 py-4">
                                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest ${t.status === "Completado" || t.status === "Pagado" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-white/10 text-white/50 border border-white/20"}`}>
                                            {t.status}
                                        </span>
                                    </td>
                                    <td className={`px-6 py-4 font-black text-right ${t.type === "income" ? "text-green-400" : "text-red-400"}`}>
                                        {t.type === "income" ? "+" : "-"}${t.amount.toLocaleString("es-MX")}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

            {/* Info Modal */}
            {activeInfo && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={() => setActiveInfo(null)}
                >
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div
                        className="relative w-full max-w-md bg-[#111] border border-white/[0.12] rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setActiveInfo(null)}
                            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
                                <Info className="w-4 h-4 text-amber-400" />
                            </div>
                            <h3 className="text-white font-black text-lg">{activeInfo.title}</h3>
                        </div>

                        <p className="text-white/60 text-sm leading-relaxed mb-5">{activeInfo.description}</p>

                        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 mb-5">
                            <p className="text-white/30 text-[10px] uppercase tracking-widest font-semibold mb-1">Fórmula</p>
                            <p className="text-amber-300 text-sm font-mono">{activeInfo.formula}</p>
                        </div>

                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl px-4 py-3">
                            <p className="text-white/30 text-[10px] uppercase tracking-widest font-semibold mb-1">Contexto actual</p>
                            <p className="text-white/80 text-sm leading-relaxed">{activeInfo.context}</p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function MetricCard({ title, value, icon: Icon, color, bg, border, isCurrency = true, info, onInfoClick }: any) {
    return (
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-5 relative overflow-hidden group hover:border-white/[0.15] transition-all">
            <div className="flex justify-between items-start mb-3">
                <button
                    onClick={() => info && onInfoClick?.(info)}
                    className={`w-10 h-10 rounded-xl ${bg} ${border} border flex items-center justify-center ${color} transition-all duration-300 group-hover:scale-110 ${info ? "cursor-pointer hover:ring-2 hover:ring-white/20 hover:brightness-125" : "cursor-default"}`}
                    title={info ? "Ver explicación" : undefined}
                >
                    <Icon className="w-5 h-5" />
                </button>
                {info && (
                    <span className="text-white/20 text-[9px] font-semibold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity select-none pt-1">
                        toca el ícono
                    </span>
                )}
            </div>
            <p className="text-white/50 text-xs font-medium mb-1">{title}</p>
            <h3 className="text-2xl font-black text-white tracking-tight">
                {isCurrency ? "$" + Number(value).toLocaleString("es-MX") : Number(value).toLocaleString("es-MX")}
            </h3>
        </div>
    );
}
