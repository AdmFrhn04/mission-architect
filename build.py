import pathlib
src = pathlib.Path(__file__).parent / 'src'
html = (src/'shell.html').read_text()
for tag, f in [('/*CSS*/','style.css'),('/*LOGIC*/','logic.js'),('/*VISUALS*/','visuals.js'),('/*APP*/','app.js')]:
    html = html.replace(tag, (src/f).read_text())
out = pathlib.Path(__file__).parent / 'dist'; out.mkdir(exist_ok=True)
(out/'index.html').write_text(html)
print('built', len(html), 'bytes')
