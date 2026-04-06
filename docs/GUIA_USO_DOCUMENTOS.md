# 📖 GUÍA DE USO DE DOCUMENTOS DE ANÁLISIS

**Propósito:** Instrucciones para usar los documentos de análisis con diferentes tipos de agentes y stakeholders.

---

## 📂 DOCUMENTOS DISPONIBLES

### 1. `ANALISIS_PROYECTO_COMPLETO.md` (Completo)
- **Tamaño:** ~15,000 palabras
- **Tiempo de lectura:** 45-60 minutos
- **Nivel de detalle:** Exhaustivo
- **Audiencia:** Fundadores, equipo técnico, inversores que quieren deep dive

### 2. `RESUMEN_EJECUTIVO.md` (Ejecutivo)
- **Tamaño:** ~3,000 palabras
- **Tiempo de lectura:** 10-15 minutos
- **Nivel de detalle:** Alto nivel con datos clave
- **Audiencia:** Inversores, advisors, presentaciones pitch

### 3. `CONTEXTO_PARA_AGENTE.md` (Técnico)
- **Tamaño:** ~2,500 palabras
- **Formato:** YAML + Markdown
- **Nivel de detalle:** Técnico con instrucciones
- **Audiencia:** Agentes IA, desarrolladores nuevos, onboarding técnico

---

## 🤖 CASOS DE USO CON AGENTES IA

### Caso 1: Asistente de Desarrollo (Claude, ChatGPT, GitHub Copilot)

**Objetivo:** Que el agente entienda el proyecto para ayudar con código.

**Documento recomendado:** `CONTEXTO_PARA_AGENTE.md`

**Ejemplo de prompt:**
```markdown
He aquí el contexto completo del proyecto en el que estoy trabajando:

[Pegar contenido de CONTEXTO_PARA_AGENTE.md]

Ahora quiero que me ayudes a [tarea específica]:
- Implementar la integración con Facturama para CFDI
- Escribir tests E2E para el flujo de onboarding
- Refactorizar el sistema de multi-tenancy para mejor performance
- etc.

Recuerda respetar las convenciones del proyecto y prioridades actuales.
```

**Tips:**
- El agente tendrá contexto de stack, arquitectura, deuda técnica
- Conocerá las decisiones de diseño y por qué se tomaron
- Respetará las convenciones (no sugerirá Prisma si el proyecto usa Supabase SDK)

### Caso 2: Agente de Investigación de Mercado

**Objetivo:** Profundizar en análisis de competencia o mercado LATAM.

**Documento recomendado:** `ANALISIS_PROYECTO_COMPLETO.md` (Fase 5)

**Ejemplo de prompt:**
```markdown
Contexto del proyecto:

[Pegar solo la FASE 5: MERCADO Y COMPETENCIA del análisis completo]

Necesito que investigues más a fondo:
- Nuevos competidores que hayan lanzado en LATAM en últimos 6 meses
- Cambios regulatorios en facturación electrónica en México 2026
- Pricing actualizado de Mindbody/Wodify en región
- Oportunidades de partnership con influencers fitness LATAM

Presenta hallazgos en formato tabla comparativa.
```

### Caso 3: Agente de Estrategia de Producto

**Objetivo:** Priorizar features o diseñar roadmap.

**Documento recomendado:** `RESUMEN_EJECUTIVO.md` + Fase 6 del completo

**Ejemplo de prompt:**
```markdown
Contexto ejecutivo del proyecto:

[Pegar RESUMEN_EJECUTIVO.md]

Dado que estamos en etapa de validación PMF con 0 usuarios paying:

1. ¿Cuáles son las 5 features más críticas para lanzar beta con 10 studios?
2. ¿Qué podemos eliminar del roadmap actual sin afectar value proposition?
3. ¿Cómo priorizarías entre CFDI automático vs. WhatsApp notifications?
4. ¿Qué métricas debemos trackear en dashboard para demostrar ROI a studios?

Justifica cada recomendación con datos del análisis.
```

### Caso 4: Agente de GTM (Go-to-Market)

**Objetivo:** Diseñar estrategia de adquisición de clientes.

**Documento recomendado:** Fase 2 (Modelo de Negocio) + Fase 5 (Mercado)

**Ejemplo de prompt:**
```markdown
Contexto de mercado y pricing:

[Pegar Fase 2 y Fase 5 del ANALISIS_PROYECTO_COMPLETO.md]

Con un budget de $5,000 USD para los próximos 3 meses:

1. ¿Cómo distribuirías el presupuesto entre canales (ads, content, influencers)?
2. ¿Qué mensaje/hook usarías en ads para Facebook/Instagram?
3. ¿Qué 10 keywords de SEO atacarías primero?
4. ¿Cómo estructurarías el programa de referidos?
5. ¿Qué partnerships serían más valiosos?

Considera que CAC target es <$500 USD y LTV $9,600-39,000 según tier.
```

### Caso 5: Agente de Análisis Financiero

**Objetivo:** Modelar proyecciones financieras o fundraising deck.

**Documento recomendado:** Fase 2 (Unit Economics) + Fase 6 (Roadmap)

**Ejemplo de prompt:**
```markdown
Contexto financiero del proyecto:

[Pegar secciones de Unit Economics y Roadmap]

Necesito construir un modelo financiero para próximos 24 meses:

Asunciones:
- Mes 1-3: 0 → 10 studios (pilot)
- Mes 4-12: 10 → 50 studios
- Mes 13-24: 50 → 200 studios
- Mix de planes: 50% Starter, 35% Pro, 15% Elite
- Churn mensual: 5% (Starter), 3% (Pro), 2% (Elite)
- CAC: $3,500 / $5,000 / $8,000 por tier

Genera:
1. Proyección MRR/ARR mensual
2. Burn rate considerando team hiring
3. Runway hasta break-even
4. Cuánto capital necesitamos raise
```

---

## 👥 CASOS DE USO CON HUMANOS

### Para Fundadores

**Documento:** `ANALISIS_PROYECTO_COMPLETO.md`

**Usos:**
- Referencia completa para decisiones estratégicas
- Onboarding de co-founders o advisors
- Base para crear pitch deck
- Identificar gaps en conocimiento de mercado

**Recomendación:** Leer completo 1 vez, luego usar como referencia.

### Para Inversores

**Documento:** `RESUMEN_EJECUTIVO.md`

**Usos:**
- Due diligence inicial (10 minutos)
- Evaluar oportunidad de inversión
- Identificar red flags rápidamente
- Decidir si vale la pena deeper dive

**Recomendación:** Empezar con resumen, pedir análisis completo si hay interés.

### Para Equipo de Desarrollo

**Documento:** `CONTEXTO_PARA_AGENTE.md`

**Usos:**
- Onboarding de nuevos developers
- Entender decisiones de arquitectura
- Conocer deuda técnica antes de refactorizar
- Alinearse en prioridades técnicas

**Recomendación:** Leer sección de arquitectura + prioridades.

### Para Marketing/Sales

**Documento:** Fase 1 (Value Prop) + Fase 2 (Pricing) del completo

**Usos:**
- Crear messaging para ads
- Entender pain points de clientes
- Diseñar sales scripts
- Preparar objeciones comunes

**Recomendación:** Enfocarse en propuesta de valor y competencia.

---

## 🔄 MANTENER DOCUMENTOS ACTUALIZADOS

### Cuándo Actualizar

**Actualización Mayor (nueva versión):**
- Cambio de etapa del producto (Beta → Launch → Growth)
- Pivot de modelo de negocio o pricing
- Entrada/salida de competidores importantes
- Cambios regulatorios significativos
- Validación/invalidación de hipótesis clave

**Actualización Menor (patches):**
- Nuevas métricas (usuarios, MRR)
- Features completadas del roadmap
- Deuda técnica resuelta
- Pequeños ajustes de pricing

### Proceso de Actualización

```yaml
paso_1:
  accion: Crear branch "docs/update-analysis-v1.1"

paso_2:
  accion: Actualizar sección relevante en ANALISIS_PROYECTO_COMPLETO.md

paso_3:
  accion: Actualizar métricas en RESUMEN_EJECUTIVO.md

paso_4:
  accion: Si hay cambios técnicos, actualizar CONTEXTO_PARA_AGENTE.md

paso_5:
  accion: Incrementar número de versión en los 3 archivos

paso_6:
  accion: Commit con mensaje descriptivo
  ejemplo: "docs: update to v1.1 - add 10 pilot studios metrics"

paso_7:
  accion: Merge a main
```

### Versionado

```
Formato: v[MAJOR].[MINOR]

MAJOR: Cambios fundamentales (pivot, nueva etapa, restructura completa)
Ejemplos:
  - v1.0 → v2.0: Pivot de B2B a B2C
  - v1.0 → v2.0: Lanzamiento oficial (Beta → Production)

MINOR: Actualizaciones significativas pero no fundamentales
Ejemplos:
  - v1.0 → v1.1: Validación PMF con 10 studios
  - v1.1 → v1.2: Lanzamiento CFDI automático
  - v1.2 → v1.3: Alcanzar $10k MRR
```

---

## 📊 CONVERTIR A OTROS FORMATOS

### Para Pitch Deck (PowerPoint/Google Slides)

**Documento base:** `RESUMEN_EJECUTIVO.md`

**Estructura sugerida (12 slides):**
```
1. Título + Tagline
2. Problema (Pain points con datos)
3. Solución (Screenshots del producto)
4. Propuesta de Valor Única (vs. competidores)
5. Modelo de Negocio (Pricing table)
6. Mercado (TAM/SAM/SOM)
7. Competencia (Comparison matrix)
8. Tracción (Métricas actuales + proyección)
9. Roadmap (Timeline visual)
10. Equipo (Founders + advisors)
11. Financials (Unit economics + ask)
12. Visión (3 años adelante)
```

**Herramientas:**
- Pitch (pitch.com) → Templates modernos
- Canva → Diseño visual fácil
- Google Slides → Colaborativo

### Para Blog Post / Case Study

**Documento base:** Fase 1 (Value Prop) + Fase 4 (Arquitectura)

**Ejemplo de post:**
```markdown
Título: "Cómo construimos una plataforma multi-tenant para
        17,000 studios de fitness en LATAM"

Secciones:
1. El problema que descubrimos
2. Por qué las soluciones existentes no funcionan en LATAM
3. Decisiones de arquitectura (Supabase RLS + React Router)
4. Cómo facturamos CFDI automáticamente
5. Lecciones aprendidas en 6 meses
6. Roadmap público
```

### Para One-Pager (Inversores)

**Documento base:** `RESUMEN_EJECUTIVO.md` condensado

**Formato PDF de 1 página:**
```
┌─────────────────────────────────────────┐
│ PROJECT STUDIO                          │
│ Software para Boutique Fitness LATAM    │
├─────────────────────────────────────────┤
│ PROBLEMA                                │
│ - 15-20 hrs/semana en burocracia        │
│ - Facturación fiscal manual            │
│                                         │
│ SOLUCIÓN                                │
│ - Sistema todo-en-uno automatizado     │
│ - CFDI/AFIP nativo (único en mercado)  │
│                                         │
│ MERCADO                                 │
│ - TAM: $25.5M (17k studios LATAM)      │
│ - SAM: $10.2M (6.8k digitalizables)    │
│                                         │
│ MODELO DE NEGOCIO                       │
│ - SaaS: $799-3,279 MXN/mes             │
│ - LTV:CAC 2.7-4.9x                     │
│                                         │
│ TRACCIÓN                                │
│ - MVP funcional en producción          │
│ - 0-2 studios pilot (validando PMF)   │
│                                         │
│ ASK                                     │
│ - $150k USD seed                       │
│ - 12 meses runway → $10k MRR           │
└─────────────────────────────────────────┘
```

---

## ✅ CHECKLIST DE USO

### Antes de Compartir con Agente IA

- [ ] Verificar que el documento está actualizado (check version date)
- [ ] Seleccionar el documento apropiado según objetivo
- [ ] Incluir contexto adicional si es necesario (ej: "Esto es para Q2 2026")
- [ ] Especificar formato de output deseado (tabla, bullet points, código, etc.)
- [ ] Dar constraints claros (budget, timeline, tech stack)

### Antes de Compartir con Humanos

- [ ] Verificar que no hay información confidencial (API keys, financials internos)
- [ ] Adaptar lenguaje según audiencia (técnico vs. business)
- [ ] Preparar anexos si es necesario (screenshots, demos)
- [ ] Tener respuestas preparadas para preguntas obvias
- [ ] Incluir call-to-action claro (meeting, investment, partnership)

### Después de Usar

- [ ] ¿El documento respondió las preguntas del agente/humano?
- [ ] ¿Hubo información faltante que causó confusión?
- [ ] ¿El nivel de detalle fue apropiado?
- [ ] ¿Necesita actualizarse alguna sección?
- [ ] Documentar feedback para próxima versión

---

## 📞 SOPORTE

Si tienes dudas sobre cómo usar estos documentos:

1. **Para decisiones técnicas:** Revisar `CONTEXTO_PARA_AGENTE.md` sección "Instrucciones para Agentes IA"
2. **Para decisiones de negocio:** Revisar `ANALISIS_PROYECTO_COMPLETO.md` Fases 1-2-6
3. **Para decisiones estratégicas:** Revisar `RESUMEN_EJECUTIVO.md` sección "Conclusiones"

---

**Última actualización:** 2026-03-20
**Versión:** 1.0
**Maintainer:** Equipo Project Studio
