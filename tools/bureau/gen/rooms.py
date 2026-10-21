# bureau (tidl. Ascension Agency) – rumtabel: overblikkets zoner → rum i bygningen (se docs/DESIGN.md).
# Stil (CS2 Agency): luksuriøst penthouse-agency øverst i et højhus ved skumring – poleret marmor, valnød, børstet stål,
# panoramavinduer mod skylinen, varme indbyggede spots mod den kolde blå time udenfor. Teknik/kælder/varegård: rå beton.
#   floor, wall, ceil: materialer · h: loftshøjde (None = udendørs tagterrasse, 'atrium' = glastag)
#   light: armaturtype (down = varme indbyggede spots langs væggene, panel, linear, highbay, server, none)
#   lux: luksusrum (valnødvægge, lamelloft) · win: panoramavinduer på ydervægge med fri udsigt · dark: kun nødlys
L = dict(floor='marble_white', wall='lux_wall', ceil='plaster_warm', light='down', lux=True, win=True)       # lobby/repræsentation
O = dict(floor='carpet_dark', wall='plaster_warm', ceil='ceiling_paint', light='panel', win=True)            # kontorer (glat gipsloft – ingen systemloft-plader)
ROOMS = {
    # bagvejen: SWAT kører ind i parkeringskælderen/varegården bag bygningen
    'CT Spawn':      dict(floor='concrete_floor', wall='block_wall', h=5.2, ceil='arch_concrete', light='highbay'),
    'CT Forgård':    dict(floor='concrete_floor', wall='block_wall', h=5.2, ceil='arch_concrete', light='highbay'),
    'A Rampe':       dict(floor='concrete_floor', wall='concrete_wall', h=3.4, ceil='arch_concrete', light='linear'),
    'Connector A':   dict(floor='concrete_floor', wall='block_wall', h=3.2, ceil='arch_concrete', light='linear'),
    # A: datacenteret og kontrolrummet over det
    'A Forplads':    dict(floor='raised_floor', wall='metal_panel', h=3.4, ceil='ceiling_tile2', light='server'),
    'A Site':        dict(floor='raised_floor', wall='metal_panel', h=4.6, ceil='arch_concrete', light='server'),
    'Heaven':        dict(O, floor='carpet_dark', wall='lux_wall', h=3.2, lux=True),
    'Balkonen':      dict(L, h=3.6),
    'Søjlegangen A': dict(O, h=3.4),
    'Long A top':    dict(O, h=3.4),
    'Long A':        dict(O, h=3.4),
    'Connector':     dict(L, floor='marble_floor', h=3.2),                                   # kaffebar/lounge
    'Rampen':        dict(floor='concrete_floor', wall='block_wall', h=3.4, ceil='arch_concrete', light='linear'),
    # midten: atriet (main hall) med glastag
    'Arch':          dict(L, h=4.4),
    'Mid Door':      dict(L, h=3.4),
    'Top Mid':       dict(L, h=3.8),
    'Mid':           dict(L, h=7.5),                                                         # atriet: højt lamelloft
    'Mid T':         dict(L, floor='marble_floor', h=3.8),                                   # elevatorlobbyen
    'B Halls øst':   dict(O, h=3.0),
    'B Halls lomme': dict(O, h=3.0),
    'B Halls vest':  dict(O, h=3.0),
    'Vent':          dict(floor='steel_plate', wall='corrugated', h=2.4, ceil='corrugated', light='linear', dark=True),
    'Catwalk øst':   dict(floor='steel_plate', wall='block_wall', h=3.0, ceil='arch_concrete', light='linear'),
    'Vent-gangen':   dict(floor='concrete_floor', wall='block_wall', h=3.0, ceil='arch_concrete', light='linear'),
    # syd: tagterrassen med helipad – hijackerne kommer udefra
    'T Spawn':       dict(floor='terrace', wall='facade', h=None, ceil=None, light='street'),
    'T Ramp':        dict(floor='terrace', wall='facade', h=None, ceil=None, light='street'),
    'T Base':        dict(L, h=3.6),                                                          # sikkerhedsslusen/receptionen
    'Vestpassagen':  dict(floor='concrete_floor', wall='block_wall', h=3.0, ceil='arch_concrete', light='linear'),
    # teknikkælderen
    'Trappehallen':  dict(floor='concrete_old', wall='block_wall', h=4.6, ceil='arch_concrete', light='linear'),
    'Kryptgangen':   dict(floor='concrete_old', wall='concrete_wall', h=3.0, ceil='arch_concrete', light='linear'),
    'Lower B':       dict(floor='concrete_old', wall='concrete_wall', h=3.2, ceil='arch_concrete', light='linear'),            # v26: dunkelt men spilbart
    'Kryptnedgangen': dict(floor='concrete_old', wall='block_wall', h=3.0, ceil='arch_concrete', light='linear'),
    'Tunnels':       dict(floor='concrete_old', wall='concrete_wall', h=2.8, ceil='arch_concrete', light='linear', dark=True),
    'Tunnels vest':  dict(floor='concrete_old', wall='concrete_wall', h=2.8, ceil='arch_concrete', light='linear', dark=True),
    'Tunnels hjørne': dict(floor='concrete_old', wall='concrete_wall', h=2.8, ceil='arch_concrete', light='linear', dark=True),
    'Dark':          dict(floor='concrete_old', wall='concrete_wall', h=3.2, ceil='arch_concrete', light='linear', dark=True),   # v26: enkelte lysrør
    'Dark-kammeret': dict(floor='concrete_old', wall='concrete_wall', h=3.2, ceil='arch_concrete', light='linear', dark=True),
    # B: våbenkammeret og lageret
    'Main B':        dict(floor='concrete_floor', wall='block_wall', h=3.4, ceil='arch_concrete', light='linear'),
    'Catwalk':       dict(floor='steel_plate', wall='block_wall', h=4.0, ceil='arch_concrete', light='linear'),
    'Storage':       dict(floor='concrete_floor', wall='block_wall', h=4.2, ceil='arch_concrete', light='highbay'),
    'Back B':        dict(O, h=3.4),
    'Pillars B':     dict(O, h=3.6, floor='carpet_dark'),
    'B Site':        dict(floor='concrete_floor', wall='metal_panel', h=3.8, ceil='arch_concrete', light='highbay'),
}
for _r in ROOMS.values():
    _r.setdefault('lux', False); _r.setdefault('win', False)
FACADE_TOP = 13.0          # facadehøjde over terrassen (bygningens egne vægge)
PARAPET = 1.05             # tagterrassens brystning ud mod byen
ATRIUM_H = 10.5            # atriets glastag over gulvet
