// app/services/email.server.ts
// Centralized Resend email service for Project Studio / GRIND platform.
// Handles all transactional emails with branded HTML templates.

import { Resend } from "resend";

// ── Client ────────────────────────────────────────────────────────
let _resend: Resend | null = null;
function getResend(): Resend {
    if (!_resend) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey || apiKey === "re_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX") {
            console.warn("[email.server] RESEND_API_KEY not set — emails will be skipped.");
        }
        _resend = new Resend(apiKey ?? "");
    }
    return _resend;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
const FROM_NAME  = process.env.RESEND_FROM_NAME  ?? "Project Studio";

// Logo publicly hosted (use your Vercel deployment URL in production)
const LOGO_URL =
    "https://grindproject.vercel.app/images/logo-white.png";

// ── Base HTML wrapper ─────────────────────────────────────────────
function baseTemplate(content: string, accentColor = "#18181b"): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Project Studio</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#18181b;padding:32px 40px;text-align:center;">
              <img
                src="${LOGO_URL}"
                alt="Project Studio"
                width="160"
                style="display:block;margin:0 auto;max-width:160px;"
              />
            </td>
          </tr>

          <!-- Accent bar -->
          <tr>
            <td style="height:4px;background:${accentColor};"></td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:40px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f5f5f4;padding:24px 40px;text-align:center;border-top:1px solid #e7e5e4;">
              <p style="margin:0;font-size:12px;color:#a8a29e;">
                © ${new Date().getFullYear()} Project Studio · Todos los derechos reservados
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#d6d3d1;">
                Enviado por <strong>GRIND</strong> — plataforma de gestión de estudios
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Generic send helper ───────────────────────────────────────────
async function sendEmail(params: {
    to: string | string[];
    subject: string;
    html: string;
    replyTo?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey === "re_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX") {
        console.warn(`[email.server] Skipping email to ${params.to} — RESEND_API_KEY not configured.`);
        return { success: false, error: "RESEND_API_KEY not set" };
    }

    try {
        const resend = getResend();
        const { data, error } = await resend.emails.send({
            from: `${FROM_NAME} <${FROM_EMAIL}>`,
            to: Array.isArray(params.to) ? params.to : [params.to],
            subject: params.subject,
            html: params.html,
            replyTo: params.replyTo,
        });

        if (error) {
            console.error("[email.server] Resend error:", error);
            return { success: false, error: error.message };
        }

        console.log(`[email.server] ✅ Email sent to ${params.to} — ID: ${data?.id}`);
        return { success: true, id: data?.id };
    } catch (err: any) {
        console.error("[email.server] Unexpected error:", err.message);
        return { success: false, error: err.message };
    }
}

// ─────────────────────────────────────────────────────────────────
// 📧 FLOW 1 — Bienvenida de Nuevo Miembro (Estudio → Alumno)
// Trigger: admin/users.tsx → intent "create_user"
// ─────────────────────────────────────────────────────────────────
export async function sendMemberWelcome(params: {
    to: string;
    memberName: string;
    studioName: string;
    tempPassword: string;
    loginUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
    const { to, memberName, studioName, tempPassword, loginUrl = "https://grindproject.vercel.app" } = params;

    const firstName = memberName.split(" ")[0];

    const html = baseTemplate(`
      <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;color:#18181b;">
        ¡Bienvenido/a, ${firstName}! 🎉
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#57534e;line-height:1.6;">
        Tu cuenta en <strong>${studioName}</strong> ha sido creada. 
        Ya puedes acceder a la plataforma con tus datos de inicio de sesión.
      </p>

      <!-- Credentials card -->
      <div style="background:#f5f5f4;border:1px solid #e7e5e4;border-radius:12px;padding:24px;margin:0 0 28px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#a8a29e;text-transform:uppercase;letter-spacing:0.08em;">
          Tus datos de acceso
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
          <tr>
            <td style="padding:6px 0;">
              <span style="font-size:13px;color:#78716c;">Email</span>
            </td>
            <td style="padding:6px 0;text-align:right;">
              <strong style="font-size:13px;color:#18181b;">${to}</strong>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;">
              <span style="font-size:13px;color:#78716c;">Contraseña temporal</span>
            </td>
            <td style="padding:6px 0;text-align:right;">
              <code style="font-size:14px;font-weight:700;color:#18181b;background:#e7e5e4;padding:2px 8px;border-radius:6px;">${tempPassword}</code>
            </td>
          </tr>
        </table>
      </div>

      <p style="margin:0 0 20px;font-size:13px;color:#78716c;">
        Te recomendamos cambiar tu contraseña después del primer inicio de sesión.
      </p>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0;">
        <a href="${loginUrl}"
           style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;letter-spacing:0.02em;">
          Iniciar sesión →
        </a>
      </div>

      <hr style="border:none;border-top:1px solid #e7e5e4;margin:28px 0;" />

      <p style="margin:0;font-size:13px;color:#a8a29e;text-align:center;">
        ¿Tienes alguna pregunta? Contáctanos directamente con tu estudio: <strong>${studioName}</strong>
      </p>
    `, "#18181b");

    return sendEmail({
        to,
        subject: `¡Bienvenido/a a ${studioName}! Tu cuenta está lista`,
        html,
    });
}

// ─────────────────────────────────────────────────────────────────
// 🏋️ FLOW 2 — Bienvenida del Estudio (GRIND → Admin)
// Trigger: onboarding/setup/ready.tsx → completeOnboarding()
// ─────────────────────────────────────────────────────────────────
export async function sendStudioWelcomeEmail(params: {
    to: string;
    adminName: string;
    gymName: string;
    studioType: string;
    dashboardUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
    const {
        to,
        adminName,
        gymName,
        studioType,
        dashboardUrl = "https://grindproject.vercel.app/admin",
    } = params;

    const firstName = adminName.split(" ")[0];
    const studioTypeLabel: Record<string, string> = {
        pilates: "Pilates",
        cycling: "Cycling",
        yoga: "Yoga",
        barre: "Barre",
        hiit: "HIIT / Funcional",
        martial: "Artes Marciales",
        dance: "Dance",
    };

    const html = baseTemplate(`
      <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;color:#18181b;">
        ¡${gymName} ya está en vivo! 🚀
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#57534e;line-height:1.6;">
        Hola <strong>${firstName}</strong>, tu estudio de 
        <strong>${studioTypeLabel[studioType] ?? studioType}</strong> ha completado la configuración
        en la plataforma <strong>GRIND</strong>. Todo está listo para comenzar a operar.
      </p>

      <!-- Checklist -->
      <div style="background:#f5f5f4;border:1px solid #e7e5e4;border-radius:12px;padding:24px;margin:0 0 28px;">
        <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#a8a29e;text-transform:uppercase;letter-spacing:0.08em;">
          Tu estudio está configurado con
        </p>
        ${[
            "📅 Agenda y clases semanales",
            "👥 Gestión de alumnos y membresías",
            "💳 Planes y control de créditos",
            "📊 Panel de finanzas e ingresos",
            "✅ Pase de lista y control de asistencia",
        ].map(item => `
          <div style="display:flex;align-items:center;padding:8px 0;border-bottom:1px solid #e7e5e4;">
            <span style="font-size:14px;color:#292524;">${item}</span>
          </div>
        `).join("")}
      </div>

      <!-- Next steps -->
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#18181b;">
        Próximos pasos recomendados:
      </p>
      <ol style="margin:0 0 28px;padding-left:20px;color:#57534e;font-size:14px;line-height:2;">
        <li>Agrega a tus primeros alumnos desde <strong>Usuarios → Agregar Miembro</strong></li>
        <li>Crea tu horario semanal en <strong>Agenda → Horarios</strong></li>
        <li>Configura tus planes desde <strong>Planes y Precios</strong></li>
      </ol>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0;">
        <a href="${dashboardUrl}"
           style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;letter-spacing:0.02em;">
          Ir a mi dashboard →
        </a>
      </div>

      <hr style="border:none;border-top:1px solid #e7e5e4;margin:28px 0;" />

      <p style="margin:0;font-size:13px;color:#a8a29e;text-align:center;">
        ¿Tienes dudas? Escríbenos directamente respondiendo este correo.
      </p>
    `, "#18181b");

    return sendEmail({
        to,
        subject: `¡${gymName} está listo en GRIND! 🚀`,
        html,
    });
}

// ─────────────────────────────────────────────────────────────────
// 🎟️ FLOW 3 — Membresía Asignada (Studio → Alumno)
// Trigger: admin/users.tsx → intent "assign_membership"
// ─────────────────────────────────────────────────────────────────
export async function sendMembershipAssigned(params: {
    to: string;
    memberName: string;
    studioName: string;
    planName: string;
    price: number;
    credits: number;
    planType: string;
    endDate: string;
    loginUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
    const { to, memberName, studioName, planName, price, credits, planType, endDate, loginUrl = "https://grindproject.vercel.app" } = params;
    const firstName = memberName.split(" ")[0];

    const formattedPrice = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(price);

    const html = baseTemplate(`
      <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;color:#18181b;">
        ¡Tu plan está activo! 🎟️
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#57534e;line-height:1.6;">
        Hola <strong>${firstName}</strong>, tu membresía en <strong>${studioName}</strong> ha sido activada con éxito. Aquí tienes los detalles de tu plan:
      </p>

      <!-- Details card -->
      <div style="background:#f5f5f4;border:1px solid #e7e5e4;border-radius:12px;padding:24px;margin:0 0 28px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#a8a29e;text-transform:uppercase;letter-spacing:0.08em;">
          Detalles de tu membresía
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
          <tr>
            <td style="padding:6px 0;">
              <span style="font-size:13px;color:#78716c;">Plan</span>
            </td>
            <td style="padding:6px 0;text-align:right;">
              <strong style="font-size:13px;color:#18181b;">${planName}</strong>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;">
              <span style="font-size:13px;color:#78716c;">Tipo</span>
            </td>
            <td style="padding:6px 0;text-align:right;">
              <strong style="font-size:13px;color:#18181b;text-transform:capitalize;">${planType}</strong>
            </td>
          </tr>
          ${credits > 0 ? `
          <tr>
            <td style="padding:6px 0;">
              <span style="font-size:13px;color:#78716c;">Créditos</span>
            </td>
            <td style="padding:6px 0;text-align:right;">
              <strong style="font-size:13px;color:#18181b;">${credits} clases</strong>
            </td>
          </tr>
          ` : ""}
          <tr>
            <td style="padding:6px 0;">
              <span style="font-size:13px;color:#78716c;">Precio</span>
            </td>
            <td style="padding:6px 0;text-align:right;">
              <strong style="font-size:13px;color:#18181b;">${formattedPrice}</strong>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;">
              <span style="font-size:13px;color:#78716c;">Fecha de vencimiento</span>
            </td>
            <td style="padding:6px 0;text-align:right;">
              <strong style="font-size:13px;color:#18181b;">${endDate}</strong>
            </td>
          </tr>
        </table>
      </div>

      <p style="margin:0 0 20px;font-size:13px;color:#78716c;">
        Ya puedes ingresar a la plataforma para reservar tus próximas sesiones y ver tu progreso.
      </p>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0;">
        <a href="${loginUrl}"
           style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;letter-spacing:0.02em;">
          Reservar una sesión →
        </a>
      </div>

      <hr style="border:none;border-top:1px solid #e7e5e4;margin:28px 0;" />

      <p style="margin:0;font-size:13px;color:#a8a29e;text-align:center;">
        ¿Tienes alguna pregunta? Escríbenos respondiendo directamente a este correo o contacta a tu estudio <strong>${studioName}</strong>.
      </p>
    `, "#18181b");

    return sendEmail({
        to,
        subject: `¡Tu plan en ${studioName} ya está activo! 🎟️`,
        html,
    });
}

// ─────────────────────────────────────────────────────────────────
// ✅ FLOW 4 — Confirmación de Clase Reservada / Asistencia (Studio → Alumno)
// Trigger: admin/schedule.tsx → intents "checkin", "add_to_class"
// ─────────────────────────────────────────────────────────────────
export async function sendClassConfirmation(params: {
    to: string;
    memberName: string;
    studioName: string;
    className: string;
    classDate: string;
    classTime: string;
    instructorName?: string;
    loginUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
    const { to, memberName, studioName, className, classDate, classTime, instructorName, loginUrl = "https://grindproject.vercel.app" } = params;
    const firstName = memberName.split(" ")[0];

    const html = baseTemplate(`
      <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;color:#18181b;">
        ¡Asistencia confirmada! ✅
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#57534e;line-height:1.6;">
        Hola <strong>${firstName}</strong>, hemos registrado tu asistencia en <strong>${studioName}</strong> para tu clase. ¡Prepárate para darlo todo!
      </p>

      <!-- Details card -->
      <div style="background:#f5f5f4;border:1px solid #e7e5e4;border-radius:12px;padding:24px;margin:0 0 28px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#a8a29e;text-transform:uppercase;letter-spacing:0.08em;">
          Detalles de la sesión
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
          <tr>
            <td style="padding:6px 0;">
              <span style="font-size:13px;color:#78716c;">Clase</span>
            </td>
            <td style="padding:6px 0;text-align:right;">
              <strong style="font-size:13px;color:#18181b;">${className}</strong>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;">
              <span style="font-size:13px;color:#78716c;">Fecha</span>
            </td>
            <td style="padding:6px 0;text-align:right;">
              <strong style="font-size:13px;color:#18181b;">${classDate}</strong>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;">
              <span style="font-size:13px;color:#78716c;">Hora</span>
            </td>
            <td style="padding:6px 0;text-align:right;">
              <strong style="font-size:13px;color:#18181b;">${classTime}</strong>
            </td>
          </tr>
          ${instructorName ? `
          <tr>
            <td style="padding:6px 0;">
              <span style="font-size:13px;color:#78716c;">Instructor</span>
            </td>
            <td style="padding:6px 0;text-align:right;">
              <strong style="font-size:13px;color:#18181b;">${instructorName}</strong>
            </td>
          </tr>
          ` : ""}
        </table>
      </div>

      <p style="margin:0 0 20px;font-size:13px;color:#78716c;">
        Recuerda llegar con unos minutos de anticipación. ¡Disfruta de la sesión!
      </p>

      <hr style="border:none;border-top:1px solid #e7e5e4;margin:28px 0;" />

      <p style="margin:0;font-size:13px;color:#a8a29e;text-align:center;">
        ¿Necesitas reprogramar o tienes dudas? Contacta directamente a tu estudio <strong>${studioName}</strong>.
      </p>
    `, "#18181b");

    return sendEmail({
        to,
        subject: `¡Asistencia confirmada para ${className}! ✅`,
        html,
    });
}

// ─────────────────────────────────────────────────────────────────
// ⚠️ FLOW 5 — Membresía Próxima a Vencer (Studio → Alumno)
// Trigger: admin/users.tsx → manual triggers o cron/dashboard
// ─────────────────────────────────────────────────────────────────
export async function sendMembershipExpiringSoon(params: {
    to: string;
    memberName: string;
    studioName: string;
    planName: string;
    endDate: string;
    daysRemaining: number;
    renewUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
    const { to, memberName, studioName, planName, endDate, daysRemaining, renewUrl = "https://grindproject.vercel.app" } = params;
    const firstName = memberName.split(" ")[0];

    const html = baseTemplate(`
      <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;color:#dc2626;">
        Tu membresía vence pronto ⚠️
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#57534e;line-height:1.6;">
        Hola <strong>${firstName}</strong>, te escribimos de <strong>${studioName}</strong> para recordarte que tu plan <strong>${planName}</strong> está próximo a expirar.
      </p>

      <!-- Warning card -->
      <div style="background:#fef2f2;border:1px solid #fee2e2;border-radius:12px;padding:24px;margin:0 0 28px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#b91c1c;text-transform:uppercase;letter-spacing:0.08em;">
          Información de vencimiento
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
          <tr>
            <td style="padding:6px 0;">
              <span style="font-size:13px;color:#991b1b;">Plan</span>
            </td>
            <td style="padding:6px 0;text-align:right;">
              <strong style="font-size:13px;color:#7f1d1d;">${planName}</strong>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;">
              <span style="font-size:13px;color:#991b1b;">Vence el</span>
            </td>
            <td style="padding:6px 0;text-align:right;">
              <strong style="font-size:13px;color:#7f1d1d;">${endDate}</strong>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;">
              <span style="font-size:13px;color:#991b1b;">Tiempo restante</span>
            </td>
            <td style="padding:6px 0;text-align:right;">
              <strong style="font-size:13px;color:#dc2626;">${daysRemaining} días</strong>
            </td>
          </tr>
        </table>
      </div>

      <p style="margin:0 0 20px;font-size:13px;color:#78716c;">
        Te recomendamos renovar a tiempo para mantener tus beneficios y no perder tus espacios de reserva.
      </p>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0;">
        <a href="${renewUrl}"
           style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;letter-spacing:0.02em;">
          Renovar membresía →
        </a>
      </div>

      <hr style="border:none;border-top:1px solid #e7e5e4;margin:28px 0;" />

      <p style="margin:0;font-size:13px;color:#a8a29e;text-align:center;">
        ¿Tienes dudas o deseas cambiar de plan? Responde a este correo o contacta a tu estudio <strong>${studioName}</strong>.
      </p>
    `, "#dc2626");

    return sendEmail({
        to,
        subject: `⚠️ ¡Aviso! Tu plan en ${studioName} vence en ${daysRemaining} días`,
        html,
    });
}

