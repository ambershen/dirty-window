import json, math

def onReceive(dat, rowIndex, message, byteData, peer):
    if peer.address not in ('127.0.0.1', '::1'):
        return
    try:
        packet = json.loads(message)
        gesture = packet['gesture']
        x, y = float(packet['x']), float(packet['y'])
        if gesture not in ('point','palm','fist','none') or not all(math.isfinite(v) and 0 <= v <= 1 for v in (x,y)):
            return
        aspect = float(packet.get('aspect', 4/3))
        if not math.isfinite(aspect) or not .25 <= aspect <= 4:
            return
        # Convert tracker crop to source camera, then apply the output cover crop.
        camera = parent().op('mirror')
        source_aspect = camera.width / max(1, camera.height)
        output_aspect = 16/9
        x = (x-.5)*min(1.,aspect/source_aspect)*max(1.,source_aspect/output_aspect)+.5
        y = (y-.5)*min(1.,source_aspect/aspect)*max(1.,output_aspect/source_aspect)+.5
        if not (0 <= x <= 1 and 0 <= y <= 1):
            gesture = 'none'
            x,y = .5,.5
        now = absTime.seconds
        c = parent()
        previous = c.fetch('hand', None)
        speed = 0.
        if previous and gesture in ('point','palm') and previous['gesture'] == gesture and 0 < now-previous['seen'] < .25:
            distance = math.hypot(x-previous['x'],y-previous['y'])
            if distance < .25:
                speed = min(2., distance/max(1/120, now-previous['seen']))
        c.store('hand', {'x':x, 'y':y, 'gesture':gesture, 'seen':now, 'speed':speed})
    except (ValueError, TypeError, KeyError):
        return
