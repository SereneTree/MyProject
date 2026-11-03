from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from PIL import Image

ROOT=Path('/Users/liboyu/Downloads/RD/MyProject')
OUT=ROOT/'output/images'
OUT.mkdir(parents=True,exist_ok=True)
pdfmetrics.registerFont(TTFont('CN','/Library/Fonts/Arial Unicode.ttf'))
W,H=720,1160
c=canvas.Canvas(str(ROOT/'tmp/pdfs/网站价值一图说明.pdf'),pagesize=(W,H))
c.setTitle('计算机专业学习与发展规划平台 一图说明')
def rect(x,y,w,h,bg='#ffffff',stroke=None,r=16):
 c.setFillColor(HexColor(bg));c.setStrokeColor(HexColor(stroke or bg))
 c.roundRect(x,H-y-h,w,h,r,fill=1,stroke=bool(stroke))
def txt(s,x,y,w,size=14,color='#172033',leading=None):
 p=Paragraph(s,ParagraphStyle('s',fontName='CN',fontSize=size,leading=leading or size*1.6,textColor=HexColor(color),wordWrap='CJK'))
 _,h=p.wrap(w,1000);p.drawOn(c,x,H-y-h);return h
def im(path,x,y,w,h=None,crop=None):
 img=Image.open(path)
 if crop:img=img.crop(crop)
 if h is None:h=w*img.height/img.width
 c.drawImage(ImageReader(img),x,H-y-h,width=w,height=h,mask='auto')

rect(0,0,W,H,'#f4f7fd',r=0)
im(ROOT/'public/logo.png',32,25,34,34)
txt('计算机专业学习与发展规划平台',78,29,610,17,'#173057')

rect(24,80,672,180,'#e5eeff',r=24)
txt('把课程学习',46,98,620,34,'#172f57',42)
txt('与升学就业规划连起来',46,144,630,34,'#2563eb',44)
txt('给学生一个清晰的下一步，也给家长一份共同讨论的依据。',48,210,620,15,'#4b6385')

txt('一个平台  三类帮助',32,281,650,22)
for i,(title,desc,foot) in enumerate([
 ('学习资源','按年级、课程查找资料','课件讲义 · 大作业解析\n历年考试 · 职场展望'),
 ('生涯规划','比较方向，理解准备路径','求职 · 留学 · 长期随访\n保研专区筹备中'),
 ('咨询服务','带着具体问题进一步沟通','填写背景与当前困惑\n提交 1v1 咨询意向')]):
 x=32+i*222
 rect(x,325,212,154,'#ffffff','#dce6f5')
 txt(f'0{i+1}',x+14,336,180,12,'#2563eb')
 txt(title,x+14,359,180,20,'#173057')
 txt(desc,x+14,397,184,12,'#415574')
 txt(foot.replace('\n','<br/>'),x+14,429,184,11,'#6a7b93')

for x,title,subtitle,items in [
 (32,'对学生','从“看资料”到“有计划地准备”',[
  ('找资料更有条理','按课程定位资料，减少零散查找。'),
  ('了解更多可能','比较求职、留学等方向，参考真实成长案例。'),
  ('把准备做在当下','围绕课程、项目、简历与面试安排下一步。')]),
 (370,'对家长','从“催进度”到“理解准备过程”',[
  ('看懂孩子在准备什么','了解课程学习与未来发展之间的关联。'),
  ('讨论选择更具体','从兴趣、背景和目标出发，比较不同方向。'),
  ('沟通更有依据','一起梳理准备重点，必要时提交咨询意向。')])]:
 rect(x,505,318,261,'#ffffff','#dce6f5')
 txt(title,x+16,518,286,21,'#2563eb')
 txt(subtitle,x+16,552,286,12,'#64748b')
 for j,(head,body) in enumerate(items):
  y=586+j*56
  rect(x+16,y+5,5,5,'#6698ed',r=2)
  txt(head,x+30,y,270,13,'#173057')
  txt(body,x+30,y+22,266,11,'#64748b')

txt('为什么值得早点开始',32,790,656,22)
txt('把长期目标拆成今天能做的事，减少临近申请或求职时的临时准备。',32,827,650,14,'#526681')
for i,label in enumerate(['学好课程','积累项目','了解方向','制定行动']):
 x=32+i*168
 rect(x,868,150,45,'#e4edff',r=10)
 txt(label,x+19,878,120,17,'#2454a2')
 if i<3:txt('→',x+152,879,18,15,'#6a83ab')

rect(24,941,672,160,'#173b76',r=22)
txt('现在就从一门课或一个问题开始',46,958,628,23,'#ffffff')
txt('学生  选择年级和课程，先看与你当前学习相关的资源。<br/>家长  与孩子一起浏览生涯规划，再讨论目标和准备重点。',46,1004,620,14,'#e0ebff',24)
txt('学习资料当前免费开放，无需登录注册即可查看。',46,1065,620,12,'#bcd5ff')
txt('功能与开放状态以网站页面为准。平台提供学习与规划支持，选择和准备仍需学生持续参与。',32,1120,655,10,'#74849c')
c.save()
print(ROOT/'tmp/pdfs/网站价值一图说明.pdf')
