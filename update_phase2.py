import re

# 1. Update members.html
with open('members.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Add X icon to each member header
replacement = r'''<span class="member-card__role">\1</span>
      </div>
      <div style="margin-left: auto;">
        <a href="https://x.com/Corner_neighbor" target="_blank" rel="noopener noreferrer" style="color: #1da1f2; font-size: 1.2em; border-bottom: none;" title="X (Twitter)"><i class="icon brands fa-twitter"></i></a>
      </div>
    </div>'''
content = re.sub(r'<span class="member-card__role">([^<]+)</span>\s*</div>\s*</div>', replacement, content)

with open('members.html', 'w', encoding='utf-8') as f:
    f.write(content)

# 2. Update index.html to add Note section
with open('index.html', 'r', encoding='utf-8') as f:
    index_content = f.read()

note_section = '''
		<!-- Note Articles (Latest Activity) -->
		<section id="two">
			<div class="inner">
				<header class="major">
					<h2>最新の活動記録</h2>
				</header>
				<p>はじっこぐらしの裏側や、日々の活動をnoteで発信しています！</p>
				<div style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 2em;">
					<!-- Note Card 1 -->
					<a href="https://note.com/hajikkogurashi01/n/n5c3d29c281e1" target="_blank" rel="noopener noreferrer" style="flex: 1 1 300px; background: rgba(255,255,255,0.05); border-radius: 8px; overflow: hidden; text-decoration: none; border: 1px solid rgba(255,255,255,0.1); transition: transform 0.3s, box-shadow 0.3s;" class="note-card">
						<div style="height: 160px; background: url('assets/images/pic02.webp') center/cover;"></div>
						<div style="padding: 20px;">
							<h3 style="font-size: 1.2em; margin-bottom: 10px; color: #fff;">東京ゲームダンジョンに行ってきた</h3>
							<p style="font-size: 0.9em; color: rgba(255,255,255,0.7); margin: 0;">2025年05月09日</p>
						</div>
					</a>
					<!-- Note Card 2 (Placeholder) -->
					<a href="https://note.com/hajikkogurashi01" target="_blank" rel="noopener noreferrer" style="flex: 1 1 300px; background: rgba(255,255,255,0.05); border-radius: 8px; overflow: hidden; text-decoration: none; border: 1px solid rgba(255,255,255,0.1); transition: transform 0.3s, box-shadow 0.3s;" class="note-card">
						<div style="height: 160px; background: url('assets/images/pic03.webp') center/cover;"></div>
						<div style="padding: 20px;">
							<h3 style="font-size: 1.2em; margin-bottom: 10px; color: #fff;">はじっこぐらし、活動開始！</h3>
							<p style="font-size: 0.9em; color: rgba(255,255,255,0.7); margin: 0;">2024年08月16日</p>
						</div>
					</a>
				</div>
				<ul class="actions">
					<li><a href="https://note.com/hajikkogurashi01" class="button next" target="_blank" rel="noopener noreferrer">noteをもっと読む</a></li>
				</ul>
			</div>
		</section>

		<!-- Contact -->'''

# Insert before Contact section if not already inserted
if '<!-- Note Articles (Latest Activity) -->' not in index_content:
    index_content = index_content.replace('<!-- Contact -->', note_section)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(index_content)

print("Updated members.html and index.html")