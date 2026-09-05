with open("src/pages/Game.tsx", "r") as f:
    c = f.read()

target1 = """              p.id === game.current_player_id ? "scale-110 opacity-100" : "opacity-50 scale-90"
            )}>"""
repl1 = """              p.user_id === game.current_player_id ? "scale-110 opacity-100" : "opacity-50 scale-90"
            )}>"""

target2 = """                p.id === game.current_player_id ? "border-white shadow-[0_0_15px_rgba(255,255,255,0.5)]" : "border-transparent opacity-50"
              )}>"""
repl2 = """                p.user_id === game.current_player_id ? "border-white shadow-[0_0_15px_rgba(255,255,255,0.5)]" : "border-transparent opacity-50"
              )}>"""

if target1 in c:
    c = c.replace(target1, repl1)
    print("Replaced bug 1")
if target2 in c:
    c = c.replace(target2, repl2)
    print("Replaced bug 2")

with open("src/pages/Game.tsx", "w") as f:
    f.write(c)
