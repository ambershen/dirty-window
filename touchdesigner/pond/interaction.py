import math
last = None
was_down = False
last_time = None
last_motion = -1000.
last_entry = -1000.
entry_start = -1000.
entry_duration = .55
entry_volume = .12
motion_level = 0.
smoothed_level = 0.
next_voice = -1000.
voice_starts = [-1000., -1000.]
variation = 0
peak_mix = 0.
contact_frames = 0
last_source = "none"

def envelope(age, duration, attack=.025, release=.3):
    if age < 0 or age >= duration:
        return 0.
    return min(1., age / attack, (duration-age) / release)

def update_audio(c, now, dt, pos, down, speed, hard_stop=False):
    global last_motion, last_entry, entry_start, entry_duration, entry_volume
    global motion_level, smoothed_level, next_voice, variation
    if hard_stop:
        motion_level = 0.
        entry_start = -1000.
    # One quiet entry per contact, with a debounce for tracking dropouts.
    if down and not was_down and now-last_entry > .35:
        entry = c.op('entry_recording')
        entry.par.cuepoint = 0.
        entry.par.cuepulse.pulse()
        entry_start = last_entry = now
        entry_duration, entry_volume = .55, .12
    if not down and was_down and not hard_stop and now-last_entry > .15:
        entry = c.op('entry_recording')
        entry.par.cuepoint = .55
        entry.par.cuepulse.pulse()
        entry_start = now
        entry_duration, entry_volume = .65, .065
    if down and speed > .015:
        last_motion = now
        motion_level = min(.24, .035+math.sqrt(speed)*.15)
    target = motion_level*math.exp(-max(0., now-last_motion-.1)/.09) if down else 0.
    smoothed_level += (target-smoothed_level)*(1.-math.exp(-dt/(.035 if target>smoothed_level else .07)))
    if smoothed_level > .008 and now >= next_voice:
        slot = variation % 2
        voice = c.op('lake_recording' if slot == 0 else 'lake_recording_b')
        voice.par.cuepoint = (variation % 4)*.65
        voice.par.cuepulse.pulse()
        voice_starts[slot] = now
        variation += 1
        next_voice = now+.9
    for slot, name in enumerate(['lake_gain','lake_gain_b']):
        c.op(name).par.gain = smoothed_level*envelope(now-voice_starts[slot],1.2,.09,.3)
    c.op('entry_gain').par.gain = entry_volume*envelope(now-entry_start,entry_duration,.012,.18)
    c.op('speakers').par.pan = .325+max(0.,min(1.,pos[0]))*.35

def onFrameStart(frame):
    global last, was_down, last_time, contact_frames, last_source
    c = parent()
    now = absTime.seconds
    dt = max(1/240,min(.1,now-last_time)) if last_time is not None else 1/60
    last_time = now
    pos = (float(c.panel.u),float(c.panel.v))
    down = bool(c.panel.lselect) and bool(c.panel.inside)
    speed = min(2.,math.hypot(pos[0]-last[0],pos[1]-last[1])/dt) if last and was_down else 0.
    source = 'mouse' if down else 'none'
    radius = .014+min(.012,speed*.006)
    hard_stop = False
    hand = c.fetch('hand', None)
    if not down and hand and 0 <= now-hand['seen'] < .25:
        gesture = hand['gesture']
        pos = (hand['x'],hand['y'])
        hard_stop = gesture == 'fist'
        if gesture in ('point','palm'):
            source = gesture
            down = True
            speed = hand['speed']*math.exp(-max(0.,now-hand['seen']-.06)/.05)
            radius = .016 if gesture == 'point' else .048
    if down and source != last_source:
        was_down = False
        speed = 0.
    force = (.08 if not was_down else min(.040,speed*.040)) if down else 0.
    if source == 'palm':
        force *= .55
    s = c.op('wave_step')
    s.par.vec0valuex, s.par.vec0valuey = pos
    s.par.vec0valuez = force
    s.par.vec0valuew = radius
    update_audio(c,now,dt,pos,down,speed,hard_stop)
    if down:
        contact_frames += 1
    last, was_down = pos, down
    last_source = source
    c.op('OUT').cook(force=True)
    if c.op('recorder').par.record.eval():
        c.op('recorder').cook(force=True)
    elif c.op('pond_window').par.title.eval() != 'Pond':
        c.op('pond_window').par.title='Pond'
