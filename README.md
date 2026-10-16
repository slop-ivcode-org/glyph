# GLYPH / ASCII 3D Studio

A frontend-only 3D renderer built with vanilla JavaScript, HTML, and CSS. The
viewport is actual text, not a canvas image or WebGL effect: a software triangle
rasterizer projects geometry into a character grid, uses a depth buffer for
occlusion, and maps directional lighting to ASCII characters.

View it live here: https://slop-ivcode-org.github.io/glyph/

## Run

With Node.js installed, run `node serve.js` from the project folder and open
`http://localhost:8080`. No packages or build step are needed. This is a local
static file server only; rendering and OBJ parsing remain entirely frontend.
Stop it with Ctrl+C.

Opening `index.html` directly still supports uploaded files,
but loading project model paths requires the static server.

## Explore

- The model list comes entirely from OBJ files in `models`; the first entry loads
  automatically. There are no hardcoded meshes.
- Drag to orbit; hold Shift while dragging to pan up, down, left, or right;
  scroll to zoom. The focused viewport also supports arrow keys to orbit,
  Shift + arrow keys to pan, and `+` / `-` to zoom. Reset View recenters the
  camera and restores the default orbit and zoom.
- Switch between shaded surfaces, wireframes, and point clouds.
- Adjust character density, lighting, character palette, and phosphor color.
- Ambient light controls the shadow floor; contrast above 1 darkens midtones,
  while values below 1 brighten them. For the widest shading range, use ambient
  0, light intensity 1, and contrast 1. These lighting controls affect shaded
  surfaces and wireframes; point clouds use a fixed shade.
- Choose the Standard character palette for a light-to-dense ASCII shading ramp,
  with punctuation in shadows and dense characters such as `$` in highlights.
- Pause automatic rotation or reset the camera.
- Export the current frame as a plain-text `.txt` file.
- Copy the current frame to the clipboard, preserving ASCII spacing and line breaks.
- Load a local Wavefront `.obj` file using the file picker or drag and drop.
  `sample.obj` contains a small octahedron to try.

## Project model folder

Drop your `.obj` files into `models` (subfolders are supported), then run this
command from the project folder:

```powershell
powershell -NoProfile -File .\update-models.ps1
```

Reload the page. The dropdown lists your files.
The original torus, sphere, cube, and wave are included as OBJ files, alongside
an octahedron and a (2, 3) trefoil torus knot. Run the command again after adding,
renaming, or removing files. Edits to existing geometry only need a page reload.

The script maintains `models\manifest.js` with names and relative file paths,
not embedded geometry. The browser fetches each OBJ on first selection and caches
the parsed mesh until reload. For example:

```javascript
window.GLYPH_MODELS = [
  { name: 'octahedron.obj', path: 'models/octahedron.obj' }
];
```

Browsers cannot scan local folders, so regenerate the manifest after changing
the file list. Do not edit the generated manifest.
Invalid geometry produces an error when selected and leaves the previous model
visible.

File-picker and drag-and-drop uploads remain available as temporary previews;
they do not add entries to the project model list.

## OBJ support

Supports `v x y z` vertices and `f` polygon faces, including slash-separated
texture/normal references, negative relative vertex indices, and comments.
Texture coordinates, supplied normals, materials, and other records are ignored.
Polygons are triangulated as a fan, so use convex polygons or triangulate concave
faces before export. Faces must reference previously declared vertices.

Meshes are centered and uniformly scaled automatically. Limits are 10 MB,
50,000 vertices, and 100,000 triangles. Smaller meshes provide better interactive
performance; the renderer runs on the CPU.

Files are read locally and are never uploaded. The stylesheet optionally requests
Google Fonts for the surrounding interface; system fonts work when offline.
The ASCII viewport always uses a local monospace font.

```
                                                       mCC0vci                                      
                                                     ##vvvvivc1                                     
               ddaaaaaf                             Qf0ovCCvvcci                                    
             b88aZff00aaao                       @#0dffvvoCvvcci+                                   
             bddaZffffffZ888bbb    b@#@@@mmbb88aafCfvvcoivCvvvcc+/                                  
             ddZaZffaaaZCdbWQWM@QWWQQQ@@@mmmdZZaffC000CoociaCCvcc+                                  
             Cd8ZZ8ZZZabCWWMmWWMWWW#QQ@mbbb888baff0CCCCCCo`ci+voo+/                                 
             Cd88888ZaZmCbWMMMWWWQQ#b@@bbbb888dffff0CCCf`d#o`b1+{{+                   ZZZ0o         
              888mbd#bQ#QMMMWWQ0??:m@mmmbbbd8ddZffff00f0-Wv`QfC`W+!,            ZmQaMMM#Z.@v0v1     
              8bbbm@WdWWMMWWfi,:#@a8{mmmbbbdbddZZZaaaffCCCCCooodb`oc:        CbbQ#WffQd0Zbbboo1!:   
              cbb##M#WMMM?.`Q#@b0.@mm@mmb@bbbbbZZddaaaffCCCCcccc1?b+!::     88bd##@,vvbfco`00{{/,-  
              0d@Wb#WWWMWWQdbm:@@@@#@@@@@@@##mbbdd88aaaZfC0vCo.`111++!!:- ovf0Zaf88,v?CC+?`ov:,,-.` 
              :Z@b##WQWQd#0,@#@#@##@#####Q###mmbbd88888aaa0```.-``:``{{/:-1c?ovi?vc-ii/::-`cc...``` 
               ad#QQQQQQ#########``````QQQ@@#mmmmdddZZZZZff`//o+++{cci!//,-/+!+/?//-?i,.`-`c``````` 
              /d#m#Q##Q#Q#@##``::?1i1iic::@@@dddddff0000000v??{!{{{/!!!//:-.-/,..`````````````````  
              C8######@@@@@`-?1mmmQQWWWmQCbdbdffffddmdZaoC0ic?{{//:/Cc1``.,{````````````````````,   
             CZbmm@@mm@@@@-+Zbd@@#Q@@mmddd8ffaM@@C0oooo{?{{?!!,:,,,/`,:-,--.``..````````````.-/     
             oZ8bm@mbbbb@b8bd@@@@bb888mZZ0CCCvmciiv{{!!::`-:/,/,....--Cccc-````-,-:::.--/,{?        
            c0fdbddbbbbmbWWWmQQQQQb88o00ovo/c1-{:://....`::::-......c-`````````````.,,,,,:-         
            iaff00abmQf```````-````ooooii+?+!!!!:{???.a#!:,,:...``..`..````````..-````````-         
            ?cv000affaaaffff000vQQZiii+++?!!!{/:{://`+?,-::`.```````.```.-`````+!:.....```          
           {?cc000CffvvCfQQZZ1111``++{!{{///::/,/:,/,:{--..````````.`````.`````Ccoi1,/-```          
           !+?c?cccoc@11i```??????b++/{:::/::,,,/-/.,`---.`````:`.!8``````````8ffCii!/-``           
           ,/?c?1icc/,???????@QfCC.`//:::::,,,,-----``````.`````{8Q``````````.ffCCii:-.``           
            ,!+c1????++???bvv`.`////```````..`..``.,i///!!!!!!00#@```````````-vvC1!!,.```           
            -::{{{!+{++++o,`i{{!!!!:::///i:,---ccc88bMcvviof8d``````````````.avii1{:,.``            
             --,!{!!!++{,//////::::::,,,vC888ZZb#Wm````````````````````````-Z0fcc+::-```            
             ``-.,,/////://////:::,,,,,,---.......``````````````````````-`:baaoo?//-.```            
              ``..--,,,,,,---,,,---,,-----.......``````````````````````.,{maavo??/---``             
                ``.``...-,---...---..........`...```````````````````..-!b8Zavo1//---```             
              0f0``````````.``....````......`````````````````````...:-ddZZCvv1!!---```              
          8@#QQ#mbda0````````..```````````````````````````````..{,:!ddmafCC11!!,-````               
         mWWMMWW#Qbbbfv1`````````````````````````````````..-.,,!{,`ZaZZaav?1!!,,..``                
       0d##Q##WQ##QQbmdf0o?/```````````````````````....-::::!/::.``aaa0Coc11!,,.```                 
       0ab8bb#m#M@###m@bbZaCC1+/..``......----,,-,,,,,:++!!---````aaa0Coc?{//-.```.                 
      co10Z88dfbmm@@QQ##QmddZfocc+,baddfaa0CCvcc111//::,o#+````.{?+a0vvc??{/,..```                  
      !iCcooooaaZZm@@QWQQ#@ZbobC1?{/-{!!!//:::,,-----```:!/0i?1+1+?+Cvvc?+/,,.```                   
      !/{{/?{?occZ8@QQWQQ@@880Ccc!{:-````````````````.aWWQQQbZc+,1?{{vi??//,..``.                   
      --,,-,-/:+v08dm@@@bma0vCc{{`!:.`mbbd8`aaaaCCovv00@WWW#m8dc!`-{!!/??:,-.```                    
       .`````--,iC0dm@@baa0ii++{//````.bZZZZaaZ00CooocdbZMm#v:?.`,`{!///:-.-```-                    
       `````````!if8dZ8ffc??./,//-`````ZZZdZaZ0CCCooabcba?:`ci11.!`{{/:,--````-                     
        ``````.,{oaZfCC01111{..//..```00v!!!!!!!!!!,/-``1oii!?!..c`{!/::,--..                       
         ```````?cvCvaci{{!,,`..`.````!!!!!!!!!!!!!!!!!!/!://-`````!///,,,-.``                      
         1`````d!++v1c{{//!:/-```````!!!!!!{!!!!!!!!!!!!!`,.````:.!!::,,---```                      
         ?c0afad.{1!c!:,-..-..`````-!!!!!!{{{!!!!!!!!!!!!!!!```:!///:,:,...```                      
         ?ccoffaaa-.---```````````:{!!!!!!!{{{{{!!!!!!!!!!!!!!/!:/:::-,--..```                      
         !?covvCCaCf`````````..,`!!!!!C{{{{{{{{{!!!!!!!!!!!!!!!:,:::,,...`````                      
         :!?+vvCCCCfCvvoovvvCC!!!!!{{{{{{!!0ii{{{{{!!!!!!!!!!!!!,:----`..`````                      
          {?1i1cciccovioo1iiii{!!c{{!!!{{{{{{{{{{{!{!!!!!!!!!!!!!,,....```````                      
          :!{11+1iiciiii1iiii{!!!{{{{!!!{{{{{C{!!{{{!!!!!!!!!!!!!!.....``````.                      
          :/!{{{?++?+++++++++:!!!!{{{{{{{!0{{{{{!!{{!!!!!!!!!!!!!!..`````````                       
          -:!!{{{++++++++++++:!!!!!!!{{{{{{{!!!{{!!!!!0{!!!!!!!!.!!.`````````                       
           :/!!{{{+++++++{+++-!!!!!!!!!{{{!!!0{{{!!!!{{{!!!!!!!!!!!`````````.                       
           ,/!!!{{!!+++{{{{{{{!!!!!!!!!{{{{{{{{!!!!!!{{{{!{!!!!!!!!!````````                        
            ,/!!!{!!!!!{!!!!!!-!!!!!!!!!!{{{{!!!!v{{0!{{{{{!!!!!!:!!```,/,``                        
            ,/!{{{!//!!!///!!//!!!!!!!!!!!{!!!0{{{{0{{{{{{{{{{!!!:!!ovvc/,-.                        
            ,:/!c0##W8offZZ////!!!!!!!!!!!!!!{{{0{{{!{{!!{{{{{{!!{!!dvv1:/-                         
             ://ifmQWMMMQWmmff{{!!!!!!!!!!!!!!v{{!0v{{0{{{{{{{!!!!!mmZCv1{-`                        
             ,::+f8#WMWWW##8bd0o0!!!!!!!!!!!!!{{{{{{0{{{{{!!!{{!i!!m8ZCCC++.                        
              ,:?o#QMMMWQ#m8bafC1{!!!!!!!!!!!!!!{{{{{{{{{{{!!!!!!!W@#8ZCCc?0`                       
              -,{08#WMMM#Qmmfac{?+,!!!`!!!!!!!!!!{!{0{{{!v{{!!!!!!W@Zv`f+!/0`                       
               ,i08W,MMMQWbbb0{+,,`.`!!!`!!!!!!!!!{{{!f{{{!!ff!!!a00v+`f,,`C``                      
                1oa,,@mdb-i0f1:.-`````!!!!.!!!!!!!!{{{{{!!0!!!!!cvv1+:`f.``o``                      
               ?1oo::?0vv-iic!..```````,,!!!!,,!!!!!{{!vv0!!!!c11++/:-``````                        
               ?1?{1,/++?-i{{,`````````::,,!!!!!!!!!!!!!!!!  c11{{/..```                            
                !/,,,,--//.,:.``````             !!{{{{                                             
                     ....``..```                                                                    
```
