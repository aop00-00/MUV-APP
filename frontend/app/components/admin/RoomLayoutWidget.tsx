import { ReadOnlySeatMap, type SeatResource } from "~/components/SeatMap";
import { PlusCircle, MapPin, Trash2, Edit3, ArrowRight, User } from "lucide-react";
import { Link, useFetcher } from "react-router";

interface RoomLayoutWidgetProps {
  gym: {
    primary_color: string;
    brand_color: string;
    studio_type: string;
    booking_mode: string;
  };
  layoutConfig: {
    rows?: number;
    cols?: number;
    resources?: Array<{
      id: string;
      name: string;
      type: string;
      row: number;
      col: number;
    }>;
  };
  nextClass: any | null; // From classes table
}

export function RoomLayoutWidget({ gym, layoutConfig, nextClass }: RoomLayoutWidgetProps) {
  const brandColor = gym.brand_color || gym.primary_color || "#7c3aed";
  const fetcher = useFetcher();

  // Mapear configuración de recursos a SeatResource para ReadOnlySeatMap
  const resources: SeatResource[] = (layoutConfig.resources || []).map(r => ({
    id: r.id || r.name, // Fallback a name si id no existe
    name: r.name,
    resource_type: r.type,
    position_row: r.row,
    position_col: r.col,
    is_active: true,
  }));

  return (
    <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/[0.08] overflow-hidden w-full mb-6">
      {/* HEADER */}
      <div className="p-4 md:p-6 border-b border-white/[0.08] flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl">
            <MapPin className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Mapa en Vivo: Sala Principal
            </h2>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-tight mt-0.5">
              Gestión visual de asientos y recursos
            </p>
          </div>
        </div>

        {/* FUNCIONES RÁPIDAS (Quick Actions) */}
        <div className="flex flex-wrap items-center gap-2 mt-2 md:mt-0 w-full md:w-auto">
          <Link
            to="/admin/horarios"
            className="flex-1 md:flex-none flex justify-center items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-lg transition-all"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Crear Clase
          </Link>
          
          <button
            type="button"
            className="flex-1 md:flex-none flex justify-center items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 text-white/40 cursor-not-allowed text-xs font-bold rounded-lg group relative"
            title="Próximamente disponible en Settings"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Modificar Layout
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-900 border border-white/10 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Próximamente en Settings
            </span>
          </button>
        </div>
      </div>

      {/* CONTROLES / CONTENIDO */}
      <div className="flex flex-col lg:flex-row w-full max-h-none lg:max-h-[600px]">
        {/* PARTE IZQUIERDA: Info de Próxima Clase */}
        <div className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r border-white/[0.08] p-6 flex flex-col justify-between bg-white/[0.01]">
          <div>
            <h3 className="text-[10px] bg-white/10 inline-block px-2 py-1 rounded-full text-white/70 font-black uppercase tracking-widest mb-4">
              Próxima Sesión Programada
            </h3>
            
            {nextClass ? (
              <div className="space-y-4">
                <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
                  <div className="text-[10px] text-indigo-400 font-bold uppercase mb-1">
                    {new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(nextClass.start_time))}
                  </div>
                  <h4 className="text-2xl font-black text-white mb-2 leading-none">
                    {nextClass.title}
                  </h4>
                  <div className="flex flex-col gap-2 mt-4 text-xs font-bold text-white/60">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-white/10"><User className="w-3 h-3" /></div>
                      Coach: <span className="text-white">{nextClass.coach?.name || "Staff"}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                       <div className="px-2.5 py-1 bg-green-500/20 text-green-400 rounded-lg">
                          {nextClass.current_enrolled} Inscritos
                       </div>
                       <div className="px-2.5 py-1 bg-white/10 rounded-lg">
                          {nextClass.capacity - (nextClass.current_enrolled || 0)} Disponibles
                       </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to="/admin/schedule"
                    className="flex-1 flex justify-center items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold rounded-lg transition-all group"
                  >
                    Ver detalles completos <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </Link>

                  <fetcher.Form method="post" action="/admin/schedule" onSubmit={(e) => {
                      if(!confirm("¿Seguro que deseas eliminar esta clase inminente?")) e.preventDefault();
                  }}>
                    <input type="hidden" name="intent" value="delete_class" />
                    <input type="hidden" name="classId" value={nextClass.id} />
                    <button 
                       type="submit"
                       className="p-2 border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 rounded-lg transition-all"
                       title="Eliminar clase"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </fetcher.Form>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-white/10 rounded-xl bg-white/5 h-48">
                 <p className="text-white/40 text-sm font-bold italic mb-2">No tienes clases próximas en agenda.</p>
                 <Link to="/admin/horarios" className="text-indigo-400 hover:text-indigo-300 text-xs font-bold uppercase underline">Crear una clase</Link>
              </div>
            )}
          </div>
          
          <div className="mt-8 text-[10px] text-white/30 uppercase leading-relaxed tracking-wider">
            La vista del mapa refleja la distribución configurada de tu sala. Los lugares ocupados (grises) se sincronizan en tiempo real con las reservas activas.
          </div>
        </div>

        {/* PARTE DERECHA: Renderizado del SeatMap */}
        <div className="w-full lg:w-2/3 p-4 md:p-8 flex items-center justify-center overflow-x-auto overflow-y-auto bg-black/20 custom-scrollbar">
          {resources.length > 0 ? (
            <div className="transform scale-75 md:scale-90 lg:scale-100 origin-center">
              <ReadOnlySeatMap
                resources={resources}
                bookedIds={[]} // En el futuro se puede conectar a bookings reales
                selectedId={null}
                onSelect={() => {}} // Solo lectura
                brandColor={brandColor}
                studioType={gym.studio_type}
              />
            </div>
          ) : (
            <div className="text-white/30 text-sm font-bold uppercase tracking-widest text-center">
              No hay un layout configurado para esta sala.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
