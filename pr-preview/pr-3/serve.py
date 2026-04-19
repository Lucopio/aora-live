import http.server, os
os.chdir(r"G:\Mi unidad\Otros proyectos\AoraLive\aora-live\aora-live")
http.server.test(HandlerClass=http.server.SimpleHTTPRequestHandler, port=3000, bind='')
