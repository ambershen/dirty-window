from datetime import datetime
from pathlib import Path
held=False
folder=Path('/Users/amber/Documents/ChatGPT/dirty-window/touchdesigner/pond/recordings')

def stop_recording():
    c=parent()
    c.op('recorder').par.record=False
    c.op('recorder').cook(force=True)
    c.op('pond_window').par.title='Pond'

def onKey(dat,keyInfo):
    global held
    key=keyInfo.key.lower()
    if key in ('esc','escape') and keyInfo.state:
        stop_recording()
    if key != 'r':
        return
    if not keyInfo.state:
        held=False
        return
    if held or keyInfo.ctrl or keyInfo.cmd or keyInfo.alt:
        return
    held=True
    c=parent(); recorder=c.op('recorder')
    if recorder.par.record.eval():
        stop_recording()
    else:
        folder.mkdir(parents=True,exist_ok=True)
        recorder.par.file=str(folder/('Pond-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.mov'))
        recorder.par.record=True
        recorder.cook(force=True)
        c.op('pond_window').par.title='Pond — REC · R to stop'

def onShortcut(dat,shortcutName,time):
    return
