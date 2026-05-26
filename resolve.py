import re

def resolve_file(filepath, outpath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    pattern = re.compile(r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> origin/fix/ui-ux-improvements-570\n', re.DOTALL)

    def replacer(match):
        head_content = match.group(1) # upstream/main
        feature_content = match.group(2) # my branch
        
        if 'css' in filepath:
            # My branch truncated css and added nice things
            # Upstream main added .smart-workload-score etc.
            # So I should take my feature_content and append head_content (upstream)
            # Wait, wait... HEAD is upstream/main because I checked out upstream/main and merged!
            return feature_content + '\n' + head_content
        else:
            return feature_content + '\n' + head_content

    resolved = pattern.sub(replacer, content)

    with open(outpath, 'w', encoding='utf-8') as f:
        f.write(resolved)

resolve_file('css/index.css', 'css/index.css')
resolve_file('index.html', 'index.html')
print('Resolved temporarily')
