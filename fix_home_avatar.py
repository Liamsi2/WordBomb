import re

with open("src/pages/Home.tsx", "r") as f:
    c = f.read()

# Need to import getAvatarColor
if "getAvatarColor" not in c:
    c = c.replace("import { cn } from '../lib/utils';", "import { cn, getAvatarColor } from '../lib/utils';")

target = """<div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center font-bold">
          {profile.display_name.charAt(0)}
        </div>"""

repl = """<div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold text-white", getAvatarColor(profile.avatar_seed))}>
          {profile.display_name.charAt(0)}
        </div>"""

if target in c:
    c = c.replace(target, repl)
    print("Replaced home avatar")
else:
    print("Could not find home avatar target")

with open("src/pages/Home.tsx", "w") as f:
    f.write(c)
