"""Export the Vietnamese user guide with ReportLab (Arial fonts on Windows)."""
from pathlib import Path
import re
from html import escape
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf/Profile-MCP-Huong-dan-su-dung.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
for name, filename in [('Arial', 'arial.ttf'), ('Arial-Bold', 'arialbd.ttf'), ('Arial-Italic', 'ariali.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(Path('C:/Windows/Fonts') / filename)))
pdfmetrics.registerFontFamily('Arial', normal='Arial', bold='Arial-Bold', italic='Arial-Italic', boldItalic='Arial-Bold')
NAVY, TEAL = colors.HexColor('#17314A'), colors.HexColor('#087D83')
styles = {
    'body': ParagraphStyle('body', fontName='Arial', fontSize=10, leading=14.5, spaceAfter=7, textColor=NAVY),
    'h1': ParagraphStyle('h1', fontName='Arial-Bold', fontSize=24, leading=30, spaceAfter=15, textColor=NAVY),
    'h2': ParagraphStyle('h2', fontName='Arial-Bold', fontSize=16, leading=21, spaceBefore=14, spaceAfter=10, textColor=TEAL, keepWithNext=True),
    'cell': ParagraphStyle('cell', fontName='Arial', fontSize=8.7, leading=12.4, textColor=NAVY, splitLongWords=True),
    'thead': ParagraphStyle('thead', fontName='Arial-Bold', fontSize=9, leading=12, textColor=colors.white),
    'list': ParagraphStyle('list', fontName='Arial', fontSize=10, leading=14.5, spaceAfter=7, leftIndent=14, firstLineIndent=-12, textColor=NAVY),
    'source': ParagraphStyle('source', fontName='Arial', fontSize=8.5, leading=11, spaceAfter=4, textColor=NAVY),
}

def inline(text):
    text = text.replace('—', '-').replace('–', '-').replace('\u2011', '-')
    text = escape(text)
    code_spans = []
    def protect_code(match):
        code_spans.append(match.group(1))
        return f'ZZCODE{len(code_spans)-1}ZZ'
    text = re.sub(r'`([^`]+)`', protect_code, text)
    text = re.sub(r'\[([^\]]+)\]\((https://[^)]+)\)', r'<link href="\2" color="#087D83"><u>\1</u></link>', text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<i>\1</i>', text)
    for n, code in enumerate(code_spans):
        text = text.replace(f'ZZCODE{n}ZZ', f'<font color="#087D83">{code}</font>')
    return text

story = [Paragraph('PROFILE MCP / SHA', styles['h2']), Paragraph('Hướng dẫn sử dụng<br/>với Claude và ChatGPT', styles['h1']), Paragraph('BẢN CẬP NHẬT 10/10/2026 • CHỈ ĐỌC', styles['body']), Spacer(1, 8)]
lines = (ROOT / 'docs/USER-GUIDE.md').read_text(encoding='utf-8').splitlines()
i = 1
in_sources = False
while i < len(lines):
    line = lines[i].strip()
    if not line:
        i += 1
        continue
    if line.startswith('## '):
        heading = line[3:]
        in_sources = heading == 'Nguồn và phiên bản'
        if heading.startswith(('2.', '3.', '4.', '5.', '7.', '8.')):
            story.append(PageBreak())
        story.append(Paragraph(inline(heading), styles['h2']))
    elif line.startswith('|'):
        rows = []
        while i < len(lines) and lines[i].strip().startswith('|'):
            cells = [x.strip() for x in lines[i].strip().strip('|').split('|')]
            if not all(re.fullmatch(r':?-+:?', x) for x in cells):
                rows.append(cells)
            i += 1
        if rows[0][0] == 'Advanced OAuth settings':
            story.extend([PageBreak(), Paragraph('3. ChatGPT - cấu hình OAuth và kiểm chứng', styles['h2'])])
        widths = [151, 356] if len(rows[0]) == 2 else [110, 229, 168]
        if rows[0][0].startswith('Hiện tượng'):
            widths = [153, 146, 208]
        data = [[Paragraph(inline(x), styles['thead' if n == 0 else 'cell']) for x in row] for n, row in enumerate(rows)]
        table = Table(data, colWidths=widths, repeatRows=1, hAlign='LEFT')
        table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), NAVY),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#F0F5F7'), colors.white]),
            ('VALIGN',(0,0),(-1,-1),'TOP'),
            ('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),
            ('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),
            ('LINEBELOW',(0,0),(-1,0),1,TEAL),
        ]))
        story.extend([table, Spacer(1,10)])
        continue
    elif line.startswith('- '):
        story.append(Paragraph('• ' + inline(line[2:]), styles['source' if in_sources else 'list']))
    elif re.match(r'^\d+\. ', line):
        story.append(Paragraph(inline(line), styles['list']))
    else:
        story.append(Paragraph(inline(line), styles['source' if in_sources else 'body']))
    i += 1

def frame(c, doc):
    w,h = A4
    c.setStrokeColor(TEAL)
    c.setLineWidth(1)
    c.line(44,h-35,w-44,h-35)
    c.setFont('Arial',8)
    c.setFillColor(NAVY)
    c.drawString(44,h-26,'PROFILE MCP  /  SHA')
    c.drawRightString(w-44,h-26,'HƯỚNG DẪN SỬ DỤNG')
    c.drawString(44,26,'10/10/2026  •  Tra cứu trong quyền của người đăng nhập')
    c.drawRightString(w-44,26,str(doc.page))

doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=44, rightMargin=44, topMargin=48, bottomMargin=44,
                        title='Profile MCP - Hướng dẫn sử dụng với Claude và ChatGPT', author='Profile MCP')
doc.build(story, onFirstPage=frame, onLaterPages=frame)
print(OUT)
