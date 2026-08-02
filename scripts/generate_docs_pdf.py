from pathlib import Path
from xml.sax.saxutils import escape
import re

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Preformatted, PageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

SRC = Path('docs/RXLIST-DOCUMENTACION.md')
OUT_DIR = Path('/tmp/RXLIST_DOCUMENTACION')
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT = OUT_DIR / 'RXLIST-DOCUMENTACION.pdf'

pdfmetrics.registerFont(TTFont('DejaVu', '/usr/share/fonts/TTF/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVu-Bold', '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVu-Mono', '/usr/share/fonts/TTF/DejaVuSansMono.ttf'))

navy = colors.HexColor('#18324B')
blue = colors.HexColor('#2F80ED')
muted = colors.HexColor('#5E7183')
ink = colors.HexColor('#203040')
light = colors.HexColor('#F2F6FA')
line = colors.HexColor('#D9E3EC')
ss = getSampleStyleSheet()
ss.add(ParagraphStyle(name='TitleRX', parent=ss['Title'], fontName='DejaVu-Bold', fontSize=24, leading=29, textColor=navy, spaceAfter=8))
ss.add(ParagraphStyle(name='SubRX', parent=ss['Normal'], fontName='DejaVu', fontSize=10, leading=14, textColor=muted, spaceAfter=14))
ss.add(ParagraphStyle(name='H1RX', parent=ss['Heading1'], fontName='DejaVu-Bold', fontSize=16, leading=20, textColor=navy, spaceBefore=13, spaceAfter=7))
ss.add(ParagraphStyle(name='H2RX', parent=ss['Heading2'], fontName='DejaVu-Bold', fontSize=11.5, leading=15, textColor=blue, spaceBefore=9, spaceAfter=5))
ss.add(ParagraphStyle(name='BodyRX', parent=ss['BodyText'], fontName='DejaVu', fontSize=8.8, leading=12.5, textColor=ink, spaceAfter=4))
ss.add(ParagraphStyle(name='HeadRX', parent=ss['BodyText'], fontName='DejaVu-Bold', fontSize=8.8, leading=12.5, textColor=colors.white, spaceAfter=4))
ss.add(ParagraphStyle(name='BulletRX', parent=ss['BodyText'], fontName='DejaVu', fontSize=8.8, leading=12.5, textColor=ink, leftIndent=14, firstLineIndent=-8, spaceAfter=2))
ss.add(ParagraphStyle(name='CodeRX', fontName='DejaVu-Mono', fontSize=7.1, leading=9.2, textColor=ink, leftIndent=8, rightIndent=8, backColor=light, borderColor=line, borderWidth=.4, borderPadding=6, spaceBefore=4, spaceAfter=6))

def inline(value):
    value = escape(value)
    value = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', value)
    value = re.sub(r'`([^`]+)`', r'<font name="Courier">\1</font>', value)
    return value

def make_table(rows):
    cells = []
    for ri, row in enumerate(rows):
        parts = [x.strip() for x in row.strip().strip('|').split('|')]
        cells.append([Paragraph(inline(x), ss['HeadRX'] if ri == 0 else ss['BodyRX']) for x in parts])
    widths = [7.2 * inch / max(len(cells[0]), 1)] * len(cells[0])
    t = Table(cells, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), navy), ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, light]), ('GRID', (0, 0), (-1, -1), .35, line),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    return t

lines = SRC.read_text(encoding='utf-8').splitlines()
story = []
i = 0
while i < len(lines):
    line_text = lines[i]
    if not line_text.strip():
        story.append(Spacer(1, 3)); i += 1; continue
    if line_text.startswith('# '):
        story += [Paragraph(inline(line_text[2:]), ss['TitleRX']), Paragraph('Documentación técnica y operativa de RXList', ss['SubRX'])]
        i += 1; continue
    if line_text.startswith('## '):
        story.append(Paragraph(inline(line_text[3:]), ss['H1RX'])); i += 1; continue
    if line_text.startswith('### '):
        story.append(Paragraph(inline(line_text[4:]), ss['H2RX'])); i += 1; continue
    if line_text.startswith('```'):
        block = []
        i += 1
        while i < len(lines) and not lines[i].startswith('```'):
            block.append(lines[i]); i += 1
        story.append(Preformatted('\n'.join(block), ss['CodeRX'])); i += 1; continue
    if line_text.startswith('|'):
        rows = []
        while i < len(lines) and lines[i].startswith('|'):
            if not set(lines[i].replace('|', '').replace('-', '').replace(':', '').strip()) == set():
                rows.append(lines[i])
            i += 1
        if len(rows) >= 2: story.append(make_table(rows))
        continue
    if line_text.startswith('- '):
        story.append(Paragraph('&bull; ' + inline(line_text[2:]), ss['BulletRX'])); i += 1; continue
    if line_text[:2].isdigit() or (len(line_text) > 2 and line_text[0].isdigit() and line_text[1] == '.'):
        story.append(Paragraph(inline(line_text), ss['BulletRX'])); i += 1; continue
    story.append(Paragraph(inline(line_text), ss['BodyRX'])); i += 1

def footer(canvas, doc):
    canvas.saveState(); canvas.setStrokeColor(line); canvas.line(.65*inch, .52*inch, 7.85*inch, .52*inch)
    canvas.setFont('Helvetica', 7.2); canvas.setFillColor(muted)
    canvas.drawString(.65*inch, .34*inch, 'RXList | Documentación técnica y operativa')
    canvas.drawRightString(7.85*inch, .34*inch, f'Página {doc.page}')
    canvas.restoreState()

doc = SimpleDocTemplate(str(OUT), pagesize=letter, rightMargin=.65*inch, leftMargin=.65*inch, topMargin=.6*inch, bottomMargin=.7*inch, title='Documentación RXList')
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUT)
