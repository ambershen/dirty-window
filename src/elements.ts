import './elements.css'

document.title = 'Natural Effects'
document.getElementById('app')!.innerHTML = `
<main class="elements" aria-label="Interactive nature studies">
  <header class="elements-heading"><h1>Natural <em>Effects</em></h1></header>
  <div class="elements-landscape">
    <a class="element element-water" href="/?mode=water&background=pool" aria-label="Explore Water">
      <div class="material water-material" aria-hidden="true"></div>
      <span class="element-name">Water<span>liquid</span></span>
    </a>
    <a class="element element-ice" href="/?mode=ice" aria-label="Explore Ice">
      <div class="material ice-material" aria-hidden="true">
        <svg class="ice-veins" viewBox="0 0 500 900" preserveAspectRatio="xMidYMid slice"><defs><filter id="ice-grain"><feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter></defs><rect width="500" height="900" filter="url(#ice-grain)" opacity=".16"/><g class="fracture-shadow"><path d="M335 -20 296 125 315 204 262 291 278 350 214 424 235 505 189 561 166 680 199 738 142 920M262 291 155 268 95 310 -20 275M214 424 331 461 378 444 520 510M166 680 79 637 42 563 -20 535M315 204 400 177 425 88 510 52M235 505 289 591 342 616 365 719 520 780"/></g><g class="fracture-light"><path d="M333 -20 294 125 313 204 260 291 276 350 212 424 233 505 187 561 164 680 197 738 140 920M260 291 155 266 95 308 -20 273M212 424 331 459 378 442 520 508M164 680 79 635 42 561 -20 533M313 204 400 175 425 86 510 50M233 505 289 589 342 614 365 717 520 778"/></g></svg>
      </div>
      <span class="element-name">Ice<span>solid</span></span>
    </a>
    <a class="element element-steam" href="/?mode=steam" aria-label="Explore Steam">
      <div class="material steam-material" aria-hidden="true"><i></i><i></i><i></i></div>
      <span class="element-name">Steam<span>vapour</span></span>
    </a>
    <a class="element element-sand" href="/?mode=sand" aria-label="Explore Sand">
      <div class="material sand-material" aria-hidden="true"><svg width="100%" height="100%"><filter id="sand-grain"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#sand-grain)" opacity=".23"/></svg></div>
      <span class="element-name">Sand<span>grains</span></span>
    </a>
    <a class="element element-snow" href="/?mode=snow" aria-label="Explore Snow">
      <div class="material snow-material" aria-hidden="true"><i></i><i></i><i></i></div>
      <span class="element-name">Snow<span>powder</span></span>
    </a>
  </div>
</main>`
