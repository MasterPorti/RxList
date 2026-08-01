from math import pow
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

OUT_DIR = Path('/tmp/COCOMO_RXList')
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT = OUT_DIR / 'COCOMO_RXList.pdf'
kloc = 1.557
a, b, c, d = 2.4, 1.05, 2.5, 0.38
effort = a * pow(kloc, b)
duration = c * pow(effort, d)
staff = effort / duration
monthly_rate = 35000
cost = effort * monthly_rate

navy = colors.HexColor('#18324B')
blue = colors.HexColor('#2F80ED')
teal = colors.HexColor('#1D9A8A')
ink = colors.HexColor('#203040')
muted = colors.HexColor('#5E7183')
light = colors.HexColor('#F2F6FA')
line = colors.HexColor('#D9E3EC')
ss = getSampleStyleSheet()
ss.add(ParagraphStyle(name='TitleRX', parent=ss['Title'], fontName='Helvetica-Bold', fontSize=26, leading=30, textColor=navy, spaceAfter=8))
ss.add(ParagraphStyle(name='SubRX', parent=ss['Normal'], fontSize=11, leading=16, textColor=muted))
ss.add(ParagraphStyle(name='H1RX', parent=ss['Heading1'], fontName='Helvetica-Bold', fontSize=15, leading=19, textColor=navy, spaceBefore=12, spaceAfter=8))
ss.add(ParagraphStyle(name='BodyRX', parent=ss['BodyText'], fontSize=9.5, leading=14, textColor=ink, spaceAfter=6))
ss.add(ParagraphStyle(name='SmallRX', parent=ss['BodyText'], fontSize=8, leading=11, textColor=muted))
ss.add(ParagraphStyle(name='Metric', parent=ss['Normal'], alignment=TA_CENTER, fontName='Helvetica-Bold', fontSize=18, leading=22, textColor=navy))
ss.add(ParagraphStyle(name='MetricLabel', parent=ss['Normal'], alignment=TA_CENTER, fontSize=8.5, leading=11, textColor=muted))

def p(text, style='BodyRX'):
    return Paragraph(text, ss[style])

def money(v):
    return f'${v:,.0f} MXN'

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(line)
    canvas.line(.65*inch, .54*inch, 7.85*inch, .54*inch)
    canvas.setFont('Helvetica', 7.5); canvas.setFillColor(muted)
    canvas.drawString(.65*inch, .35*inch, 'RXList | Estimación COCOMO inicial')
    canvas.drawRightString(7.85*inch, .35*inch, f'Página {doc.page}')
    canvas.restoreState()

doc = SimpleDocTemplate(str(OUT), pagesize=letter, rightMargin=.65*inch, leftMargin=.65*inch, topMargin=.62*inch, bottomMargin=.72*inch, title='COCOMO RXList')
story = [p('COCOMO | RXList', 'TitleRX'), p('Estimación inicial de esfuerzo, calendario y costo de desarrollo', 'SubRX'), Spacer(1, .28*inch)]

metrics = [[p(f'{kloc:.3f} KLOC', 'Metric'), p(f'{effort:.2f} PM', 'Metric'), p(f'{duration:.1f} meses', 'Metric'), p(f'{staff:.2f}', 'Metric')], [p('Tamaño estimado', 'MetricLabel'), p('Esfuerzo', 'MetricLabel'), p('Duración', 'MetricLabel'), p('Equipo promedio', 'MetricLabel')]]
t = Table(metrics, colWidths=[1.8*inch]*4, rowHeights=[.38*inch, .28*inch])
t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),light),('BOX',(0,0),(-1,-1),.6,line),('INNERGRID',(0,0),(-1,-1),.4,line),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
story += [t, Spacer(1, .24*inch)]
callout = Table([[p(f'<b>Resultado ejecutivo</b><br/>Para el alcance actual de RXList, el modelo proyecta cerca de <b>{effort:.1f} persona-mes</b> y <b>{duration:.1f} meses calendario</b> con un equipo promedio de una persona. Con una tarifa de referencia de $35,000 MXN por persona-mes, el costo estimado es <b>{money(cost)}</b>.')]], colWidths=[7.2*inch])
callout.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#EAF6F4')),('BOX',(0,0),(-1,-1),.8,teal),('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),10)]))
story += [callout, Spacer(1, .18*inch), p('1. Parámetros de entrada', 'H1RX')]

params = [['Parámetro','Valor usado','Nota'], ['Tamaño','1.557 KLOC','Conteo aproximado del snapshot: 53 archivos y 1,557 líneas de código.'], ['Modo','Orgánico','Equipo pequeño, requisitos relativamente conocidos y tecnología familiar.'], ['Modelo','Basic COCOMO','Estimación paramétrica temprana; no sustituye una planificación detallada.'], ['Tarifa de referencia','$35,000 MXN / persona-mes','Supuesto editable; incluye costo promedio de desarrollo.']]
pt = Table([[p(f'<b>{x}</b>') if r==0 else p(x) for x in row] for r,row in enumerate(params)], colWidths=[1.45*inch,1.9*inch,3.85*inch], repeatRows=1)
pt.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),navy),('TEXTCOLOR',(0,0),(-1,0),colors.white),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,light]),('GRID',(0,0),(-1,-1),.4,line),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
story += [pt, Spacer(1,.15*inch), p('El tamaño se calculó a partir del código presente en el repositorio al momento de elaborar este documento; archivos generados, dependencias y artefactos de compilación no se consideran.', 'SmallRX'), p('2. Cálculo COCOMO', 'H1RX')]

formula = [['Magnitud','Fórmula','Resultado'], ['Esfuerzo','E = 2.4 x KLOC^1.05',f'{effort:.2f} persona-mes'], ['Duración','T = 2.5 x E^0.38',f'{duration:.2f} meses'], ['Equipo promedio','Personas = E / T',f'{staff:.2f} personas'], ['Costo','E x tarifa mensual',money(cost)]]
ft = Table([[p(f'<b>{x}</b>') if r==0 else p(x) for x in row] for r,row in enumerate(formula)], colWidths=[1.5*inch,3*inch,2.7*inch], repeatRows=1)
ft.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),blue),('TEXTCOLOR',(0,0),(-1,0),colors.white),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,light]),('GRID',(0,0),(-1,-1),.4,line),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
story += [ft, Spacer(1,.12*inch), p(f'Referencia de capacidad: {effort:.2f} persona-mes x 160 horas = aproximadamente {effort*160:,.0f} horas de trabajo.', 'SmallRX'), p('3. Lectura de la estimación', 'H1RX')]

phases = [['Fase','Proporción orientativa','Persona-mes','Costo orientativo'], ['Análisis y diseño','15%',f'{effort*.15:.2f}',money(cost*.15)], ['Implementación','50%',f'{effort*.50:.2f}',money(cost*.50)], ['Pruebas e integración','25%',f'{effort*.25:.2f}',money(cost*.25)], ['Despliegue y estabilización','10%',f'{effort*.10:.2f}',money(cost*.10)]]
it = Table([[p(f'<b>{x}</b>') if r==0 else p(x) for x in row] for r,row in enumerate(phases)], colWidths=[2.15*inch,1.6*inch,1.35*inch,2.1*inch])
it.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),navy),('TEXTCOLOR',(0,0),(-1,0),colors.white),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,light]),('GRID',(0,0),(-1,-1),.4,line),('ALIGN',(1,1),(-1,-1),'RIGHT'),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
story += [it, Spacer(1,.18*inch), p('Estas proporciones son una distribución de planificación, no una salida directa del modelo Basic COCOMO. Sirven para convertir la cifra total en un primer calendario de trabajo.', 'SmallRX'), p('4. Sensibilidad por tamaño', 'H1RX')]

sensitivity = [['KLOC','Esfuerzo (PM)','Duración (meses)','Costo a $35k MXN/PM']]
for size in (1.0, 1.557, 2.0, 3.0):
    e = a*pow(size,b); sensitivity.append([f'{size:.3f}',f'{e:.2f}',f'{c*pow(e,d):.2f}',money(e*monthly_rate)])
st = Table([[p(f'<b>{x}</b>') if r==0 else p(x) for x in row] for r,row in enumerate(sensitivity)], colWidths=[1.3*inch,1.75*inch,1.85*inch,2.3*inch])
st.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),blue),('TEXTCOLOR',(0,0),(-1,0),colors.white),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,light]),('GRID',(0,0),(-1,-1),.4,line),('ALIGN',(1,1),(-1,-1),'RIGHT'),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
story += [st, Spacer(1,.22*inch), p('Recomendaciones para refinarlo', 'H1RX'), p('1) Sustituir el conteo aproximado por KLOC funcional estimado. 2) Ajustar la tarifa a salario, cargas, infraestructura y margen real. 3) Recalibrar cuando exista historial del equipo. 4) Agregar contingencia de 15% a 25% para alcance, seguridad, despliegue y cambios de requisitos.', 'BodyRX'), p('Alcance observado: aplicación web RXList con Next.js/React/TypeScript, APIs, autenticación, gestión de pacientes, enfermería, camas, turnos, chat y pruebas. La cifra no incluye operación continua, licencias, hardware ni costos de servicios externos.', 'SmallRX')]
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUT)
