import { rotateJoint as rotate, type ArtModelProps } from './art-model';

export function Mew({ joints: j, ink, light, accent }: ArtModelProps) {
  return (
    <g
      stroke={ink}
      strokeWidth="2.8"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <g data-joint="tail" transform={rotate(j.tail, 272, 318)}>
        <path
          d={`M272 316 C373 330 ${405 + j.tail} 169 334 152 C277 141 115 145 120 224 C121 268 175 263 209 239`}
          stroke={ink}
          strokeWidth="14"
          fill="none"
        />
        <path
          d={`M272 316 C373 330 ${405 + j.tail} 169 334 152 C277 141 115 145 120 224 C121 268 175 263 209 239`}
          stroke={accent}
          strokeWidth="8"
          fill="none"
        />
        <ellipse
          cx="207"
          cy="240"
          rx="20"
          ry="12"
          fill={light}
          transform="rotate(-24 207 240)"
        />
      </g>
      <g data-joint="left-leg" transform={rotate(j.leftLeg, 240, 314)}>
        <path
          d="M237 298 Q207 313 213 345 L209 385 Q218 412 237 410 Q249 404 240 386 L247 351 L258 318 Z"
          fill={light}
        />
        <path
          d="M222 388 L227 403 M232 388 L235 399"
          stroke="#bb84a7"
          strokeWidth="2"
        />
      </g>
      <g data-joint="right-leg" transform={rotate(j.rightLeg, 283, 313)}>
        <path
          d="M275 298 Q306 306 307 339 L324 373 Q330 399 313 409 Q297 415 292 393 L278 357 L262 321 Z"
          fill={light}
        />
        <path
          d="M307 387 L312 402 M317 383 L322 396"
          stroke="#bb84a7"
          strokeWidth="2"
        />
      </g>
      <g data-joint="torso" transform={rotate(j.torso, 262, 279)}>
        <path
          d="M245 214 Q223 242 224 275 Q221 319 262 329 Q307 327 303 287 Q297 243 280 218 Z"
          fill={light}
        />
        <path
          d="M247 282 Q257 300 281 299"
          stroke="#fce4f2"
          strokeWidth="7"
          fill="none"
        />
        <g data-joint="left-arm" transform={rotate(j.leftArm, 241, 236)}>
          <path
            d="M241 225 L224 225 L194 242 L181 245 L181 257 L192 263 L207 257 L238 251 Z"
            fill={light}
          />
          <path
            d="M183 251 L185 260 M190 250 L192 258"
            stroke="#bb84a7"
            strokeWidth="1.5"
          />
        </g>
        <g data-joint="right-arm" transform={rotate(j.rightArm, 281, 235)}>
          <path
            d="M277 225 L295 225 L322 241 L339 242 L343 254 L333 262 L316 256 L282 251 Z"
            fill={light}
          />
          <path
            d="M336 249 L335 260 M329 250 L328 258"
            stroke="#bb84a7"
            strokeWidth="1.5"
          />
        </g>
        <g data-joint="head" transform={rotate(j.head, 262, 213)}>
          <path
            d="M214 157 L206 127 L232 138 Q263 124 291 138 L314 124 L311 159 Q325 187 305 209 Q263 239 223 209 Q204 191 214 157 Z"
            fill={light}
          />
          <path
            d="M217 145 L214 136 L225 144 M302 143 L308 132 L308 151"
            fill="#e8b4d3"
          />
          <ellipse
            cx="236"
            cy="181"
            rx="13"
            ry="22"
            fill="#f5f9ff"
            transform="rotate(-12 236 181)"
          />
          <ellipse
            cx="288"
            cy="179"
            rx="13"
            ry="22"
            fill="#f5f9ff"
            transform="rotate(12 288 179)"
          />
          <ellipse cx="240" cy="185" rx="7" ry="15" fill="#65a6c1" />
          <ellipse cx="284" cy="183" rx="7" ry="15" fill="#65a6c1" />
          <ellipse
            cx="242"
            cy="186"
            rx="3"
            ry="13"
            fill="#324b6f"
            stroke="none"
          />
          <ellipse
            cx="282"
            cy="184"
            rx="3"
            ry="13"
            fill="#324b6f"
            stroke="none"
          />
          <ellipse cx="237" cy="172" rx="4" ry="6" fill="#fff" stroke="none" />
          <ellipse cx="286" cy="170" rx="4" ry="6" fill="#fff" stroke="none" />
          <path d="M252 215 Q261 220 269 214" fill="none" strokeWidth="1.5" />
          <path
            d="M224 152 Q237 142 252 141"
            stroke="#fff0fa"
            strokeWidth="7"
            fill="none"
          />
        </g>
      </g>
    </g>
  );
}

export function Zapdos({ joints: j, ink, light, accent }: ArtModelProps) {
  return (
    <g
      stroke={ink}
      strokeWidth="2.8"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <g data-joint="tail" transform={rotate(j.tail, 261, 311)}>
        <path
          d="M224 294 L207 361 L231 349 L228 409 L255 379 L271 435 L285 373 L313 401 L301 344 L324 358 L299 302 Z"
          fill="#292c43"
        />
        <path
          d="M242 300 L228 364 L252 351 L267 413 L279 352 L298 368 L290 306 Z"
          fill={light}
        />
      </g>
      <g data-joint="left-arm" transform={rotate(j.leftArm * 0.58, 228, 227)}>
        <path
          d="M233 207 L189 179 L147 125 L154 169 L86 139 L116 191 L65 185 L122 234 L85 240 L158 269 L148 299 L204 271 L231 244 Z"
          fill="#292c43"
        />
        <path
          d="M230 206 L190 188 L164 155 L169 188 L107 161 L140 208 L91 205 L149 241 L115 251 L179 264 L162 287 L215 259 Z"
          fill={light}
        />
        <path d="M213 220 L170 224 L180 242" fill="#f8cd57" stroke="none" />
      </g>
      <g data-joint="right-arm" transform={rotate(j.rightArm * 0.58, 285, 227)}>
        <path
          d="M279 207 L326 177 L365 127 L361 167 L427 140 L397 193 L450 185 L391 233 L430 241 L356 268 L369 299 L309 271 L280 246 Z"
          fill="#292c43"
        />
        <path
          d="M280 207 L324 188 L350 153 L344 189 L406 162 L374 208 L424 205 L364 242 L399 252 L335 266 L352 287 L297 259 Z"
          fill={light}
        />
        <path d="M301 220 L347 225 L336 242" fill="#f8cd57" stroke="none" />
      </g>
      <g data-joint="torso" transform={rotate(j.torso, 259, 270)}>
        <path
          d="M228 197 L208 216 L220 239 L207 263 L225 279 L217 310 L240 294 L258 329 L278 296 L301 311 L295 281 L313 263 L298 239 L308 215 L283 200 Z"
          fill={light}
        />
        <path
          d="M234 242 L226 263 L245 281 L255 304 L275 285 L289 266 L280 241"
          fill="#e7b749"
          stroke="none"
        />
        <g data-joint="head" transform={rotate(j.head, 259, 218)}>
          <path
            d="M220 161 L210 123 L242 156 L256 106 L273 156 L306 128 L295 174 L321 184 L294 198 L302 218 L278 211 L263 230 L244 214 L218 222 L229 197 L207 183 Z"
            fill={light}
          />
          <path
            d="M231 180 L251 190 L238 197 Z M284 179 L266 191 L280 196 Z"
            fill="#fff8e4"
          />
          <path
            d="M242 187 L244 194 M275 185 L273 193"
            stroke="#39303e"
            strokeWidth="4"
          />
          <path
            d="M251 195 L266 194 L281 205 L260 230 L232 283 L224 280 L242 227 Z"
            fill={accent}
          />
          <path d="M261 202 L233 266" stroke="#fff0a7" strokeWidth="3" />
        </g>
      </g>
      <g data-joint="left-leg" transform={rotate(j.leftLeg, 238, 302)}>
        <path
          d="M230 289 L231 322 L219 341 L197 334 L184 346 L210 350 L198 367 L208 374 L229 351 L248 348 L265 360 L275 351 L251 337 L247 305 Z"
          fill={accent}
        />
        <path
          d="M197 336 L182 335 L184 346 M201 369 L199 382 L209 374 M270 351 L280 358 L275 347"
          fill="#fff9e9"
        />
      </g>
      <g data-joint="right-leg" transform={rotate(j.rightLeg, 283, 302)}>
        <path
          d="M272 290 L272 322 L287 340 L310 332 L322 344 L298 351 L312 368 L301 375 L283 352 L265 346 L250 361 L239 351 L262 336 L256 308 Z"
          fill={accent}
        />
        <path
          d="M310 333 L325 332 L322 344 M307 372 L315 382 L314 364 M243 349 L233 359 L239 347"
          fill="#fff9e9"
        />
      </g>
    </g>
  );
}

export function Ditto({ joints: j, ink, light, accent }: ArtModelProps) {
  const arm = j.leftArm * 0.65,
    other = j.rightArm * 0.6,
    rise = j.head * 0.8;
  const outline = `M159 366 C120 380 101 ${331 - arm} 124 ${288 - arm} C150 ${260 - arm} 170 294 188 270 C205 243 195 ${202 - rise} 231 ${193 - rise} C265 ${182 - rise} 280 ${230 + rise} 307 220 C345 206 361 ${234 + rise} 359 267 C359 290 397 ${272 - other} 407 ${300 - other} C429 ${339 - other} 374 354 379 380 C384 412 341 416 313 398 C291 383 281 411 246 406 C218 402 210 385 188 393 C159 406 127 399 159 366 Z`;
  return (
    <g
      stroke={ink}
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path
        data-joint="morph-body"
        data-shape={`${arm.toFixed(3)}:${other.toFixed(3)}:${rise.toFixed(3)}`}
        d={outline}
        fill={light}
      />
      <path
        data-joint="left-arm"
        d={`M155 355 Q${122 - arm} ${318 - arm} 150 ${292 - arm}`}
        stroke="#c39bd9"
        strokeWidth="11"
        fill="none"
      />
      <path
        data-joint="right-arm"
        d={`M374 336 Q${405 + other} ${315 - other} 386 ${303 - other}`}
        stroke="#f0d9ff"
        strokeWidth="8"
        fill="none"
      />
      <g data-joint="face" transform={rotate(j.head, 261, 285)}>
        <circle cx="230" cy="282" r="5" fill={ink} stroke="none" />
        <circle cx="292" cy="282" r="5" fill={ink} stroke="none" />
        <path
          d={`M228 303 Q258 ${329 + j.torso * 0.4} 294 303 Q272 ${341 + j.torso * 0.3} 243 327 Z`}
          fill="#e49eb8"
          strokeWidth="2"
        />
      </g>
      <path
        data-joint="left-foot"
        d={`M162 373 Q${191 + j.leftLeg} 393 223 389`}
        stroke={accent}
        strokeWidth="5"
        fill="none"
      />
      <path
        data-joint="right-foot"
        d={`M296 393 Q${337 + j.rightLeg} 388 366 376`}
        stroke={accent}
        strokeWidth="5"
        fill="none"
      />
      <path
        d={`M220 ${213 - rise} Q239 ${198 - rise} 254 ${216 - rise}`}
        stroke="#f3e0ff"
        strokeWidth="10"
        fill="none"
      />
    </g>
  );
}

export function Zorua({ joints: j, ink, light, accent }: ArtModelProps) {
  return (
    <g
      stroke={ink}
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <g data-joint="tail" transform={rotate(j.tail, 299, 302)}>
        <path
          d="M291 291 Q345 304 361 262 L359 218 L383 249 L402 224 L400 277 L421 265 Q422 311 384 329 L347 340 L303 324 Z"
          fill={light}
        />
        <path
          d="M373 265 L396 250 L383 280 L412 285 L390 303 L345 327"
          fill="#333142"
        />
      </g>
      <g data-joint="left-leg" transform={rotate(j.leftLeg, 234, 321)}>
        <path
          d="M225 307 L251 310 L253 351 L239 390 L216 390 L215 372 Z"
          fill={light}
        />
        <path d="M216 370 L242 373 L236 396 L208 394 Z" fill={accent} />
      </g>
      <g data-joint="right-leg" transform={rotate(j.rightLeg, 300, 321)}>
        <path
          d="M284 307 L312 309 L316 349 L309 390 L286 390 L279 373 Z"
          fill={light}
        />
        <path d="M282 372 L309 373 L311 396 L283 395 Z" fill={accent} />
      </g>
      <g data-joint="torso" transform={rotate(j.torso, 269, 293)}>
        <path
          d="M227 235 L283 231 Q322 249 323 292 L306 327 Q271 352 236 332 L217 305 Z"
          fill={light}
        />
        <path
          d="M234 267 L214 261 L225 280 L214 286 L232 300 L228 316 L245 310 L267 326 L280 311 L299 317 L294 293 L313 282 L294 274 L306 257 L283 263 Z"
          fill="#393342"
        />
        <g data-joint="left-arm" transform={rotate(j.leftArm, 227, 278)}>
          <path
            d="M220 270 L239 279 L235 322 L217 353 L198 350 L202 332 Z"
            fill={light}
          />
          <path d="M199 331 L221 337 L216 361 L191 355 Z" fill={accent} />
        </g>
        <g data-joint="right-arm" transform={rotate(j.rightArm, 286, 281)}>
          <path
            d="M280 268 L302 274 L308 313 L306 354 L284 356 L277 332 Z"
            fill={light}
          />
          <path d="M282 337 L307 334 L310 362 L283 361 Z" fill={accent} />
        </g>
        <g data-joint="head" transform={rotate(j.head, 255, 243)}>
          <path
            d="M201 171 L184 117 L226 150 Q251 142 278 151 L317 119 L307 178 L302 214 Q284 255 249 262 Q211 256 193 220 Z"
            fill={light}
          />
          <path
            d="M193 136 L210 169 L204 184 Z M301 140 L285 169 L296 186 Z"
            fill="#292738"
          />
          <path
            d="M202 159 Q216 122 242 120 L245 96 L261 109 L272 86 Q304 132 285 168 L267 191 L263 158 L246 177 L246 149 L224 177 Z"
            fill={accent}
          />
          <path
            d="M223 150 Q242 119 260 120"
            stroke="#e58b95"
            strokeWidth="7"
            fill="none"
          />
          <path
            d="M203 204 Q218 188 234 203 L235 225 Q215 246 204 226 Z M265 203 Q279 185 294 201 L294 224 Q274 245 265 222 Z"
            fill="#8be4da"
          />
          <path
            d="M203 202 Q217 190 231 204 M265 202 Q278 189 292 201"
            stroke={accent}
            strokeWidth="9"
          />
          <path
            d="M217 205 L218 224 M278 204 L276 224"
            stroke="#263d49"
            strokeWidth="4"
          />
          <ellipse cx="214" cy="210" rx="3" ry="5" fill="#fff" stroke="none" />
          <ellipse cx="279" cy="209" rx="3" ry="5" fill="#fff" stroke="none" />
          <path
            d="M219 233 Q247 216 270 234 L259 249 L239 251 Z"
            fill={light}
          />
          <ellipse cx="243" cy="236" rx="7" ry="4" fill="#2b2939" />
          <path d="M236 247 Q242 251 248 247" fill="none" strokeWidth="1.5" />
        </g>
      </g>
    </g>
  );
}
