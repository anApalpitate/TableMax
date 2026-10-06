import { rotateJoint, type ArtModelProps } from './art-model';

export function Arceus({ joints: j, ink, light, accent }: ArtModelProps) {
  return (
    <g
      stroke={ink}
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <g data-joint="tail" transform={rotateJoint(j.tail, 316, 265)}>
        <path
          d="M312 246 Q377 204 430 233 Q381 246 352 283 L313 288 Z"
          fill={light}
        />
        <path d="M338 262 L406 237" stroke="#b8b9c9" strokeWidth="8" />
      </g>
      <g data-joint="left-leg" transform={rotateJoint(j.leftLeg, 304, 290)}>
        <path
          d="M310 271 L324 318 L307 379 L294 417 L279 414 L285 371 L291 318 L286 281 Z"
          fill={light}
        />
        <path d="M283 394 L296 402 L288 430 L275 427 Z" fill={accent} />
      </g>
      <g data-joint="right-leg" transform={rotateJoint(j.rightLeg, 350, 279)}>
        <path
          d="M338 263 L365 281 L355 332 L370 386 L353 400 L337 336 L322 287 Z"
          fill={light}
        />
        <path d="M353 386 L369 381 L370 411 L357 413 Z" fill={accent} />
      </g>
      <g data-joint="torso" transform={rotateJoint(j.torso, 286, 256)}>
        <path
          d="M211 207 Q228 195 265 214 Q290 211 323 222 L367 253 L351 286 Q304 305 277 280 L231 269 L205 235 Z"
          fill={light}
        />
        <path
          d="M229 230 Q284 249 336 270 L327 289 Q278 287 250 265 Z"
          fill="#4b4c60"
        />
        <path
          d="M220 188 L201 172 L206 220 L189 232 L208 243 L224 229 Z"
          fill={light}
        />
        <g data-joint="left-arm" transform={rotateJoint(j.leftArm, 227, 248)}>
          <path
            d="M219 233 L249 247 L226 283 L220 332 L196 377 L182 368 L198 324 L197 280 Z"
            fill={light}
          />
          <path d="M184 354 L199 361 L188 397 L171 393 Z" fill={accent} />
        </g>
        <g data-joint="right-arm" transform={rotateJoint(j.rightArm, 265, 255)}>
          <path
            d="M250 242 Q282 247 276 273 L255 301 L259 349 L245 385 L230 382 L237 345 L228 293 Z"
            fill={light}
          />
          <path d="M232 366 L248 374 L241 405 L225 405 Z" fill={accent} />
        </g>
        <g data-joint="head" transform={rotateJoint(j.head, 226, 200)}>
          <path
            d="M225 218 Q190 211 194 180 L201 158 Q184 152 198 131 L212 103 Q236 125 239 160 L264 180 L253 215 Z"
            fill={light}
          />
          <path
            d="M218 134 Q252 120 274 83 Q303 41 354 60 Q315 65 296 102 L268 153 L247 180 L229 168 Z"
            fill={light}
          />
          <path d="M234 151 Q277 111 307 87 L265 144 L243 176" fill="#494a60" />
          <path
            d="M195 177 L215 163 L229 178 L213 195 L195 195 Z"
            fill="#414856"
          />
          <path
            d="M204 180 L218 177 L213 187 L201 188 Z"
            fill="#59bd8c"
            strokeWidth="1.5"
          />
          <path d="M199 188 L193 203 L202 201" fill={accent} />
          <path d="M217 116 L211 145" stroke="#fff" strokeWidth="6" />
        </g>
      </g>
      <g data-joint="divine-ring" transform={rotateJoint(j.tail / 3, 286, 262)}>
        <path
          d="M283 184 L296 198 L332 198 L341 181 L347 211 L332 232 L337 282 L358 302 L331 300 L313 323 L302 347 L299 318 L261 306 L242 325 L249 293 L227 267 L205 268 L226 252 L241 215 L237 183 L256 202 Z"
          fill={accent}
        />
        <path
          d="M261 221 L292 215 L312 234 L317 278 L300 302 L269 293 L247 267 Z"
          fill="#f9f8ea"
        />
        {[
          [257, 213],
          [327, 218],
          [318, 308],
          [238, 279],
        ].map(([x, y]) => (
          <ellipse
            key={`${x}:${y}`}
            cx={x}
            cy={y}
            rx="5"
            ry="10"
            fill="#46a36f"
            transform={`rotate(24 ${x} ${y})`}
          />
        ))}
        <path
          d="M262 206 L287 196 L323 208 M304 322 L329 289"
          stroke="#fff2ad"
          strokeWidth="4"
          fill="none"
        />
      </g>
    </g>
  );
}

export function Groudon({ joints: j, ink, light }: ArtModelProps) {
  const claw = '#f6f0e7';
  return (
    <g
      stroke={ink}
      strokeWidth="3.2"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <g data-joint="tail" transform={rotateJoint(j.tail, 230, 342)}>
        <path
          d="M248 339 Q173 319 127 350 L98 387 L107 336 L88 321 L130 309 Q193 290 248 303 Z"
          fill={light}
        />
        <path
          d="M114 334 L110 364 M144 321 L141 350 M173 312 L172 344"
          stroke="#292c39"
          strokeWidth="6"
        />
        <path
          d="M124 316 L135 291 L152 315 M161 308 L170 283 L185 307 M201 307 L210 281 L223 308"
          fill={claw}
        />
      </g>
      <g data-joint="left-leg" transform={rotateJoint(j.leftLeg, 235, 329)}>
        <path
          d="M222 299 Q186 327 204 362 L188 400 L216 426 L258 415 L258 385 L269 338 Z"
          fill={light}
        />
        <circle cx="230" cy="353" r="27" fill={light} />
        <path
          d="M190 404 L178 434 L209 421 L218 447 L234 420 L247 441 L259 410"
          fill={claw}
        />
        <path
          d="M213 331 L216 312 M246 347 L254 363"
          stroke="#252a37"
          strokeWidth="7"
        />
      </g>
      <g data-joint="right-leg" transform={rotateJoint(j.rightLeg, 312, 340)}>
        <path
          d="M301 309 Q339 316 348 349 L334 385 L356 409 L341 431 L295 425 L286 392 L275 339 Z"
          fill={light}
        />
        <path
          d="M304 417 L288 444 L317 435 L331 454 L340 430 L360 443 L353 410"
          fill={claw}
        />
      </g>
      <g data-joint="torso" transform={rotateJoint(j.torso, 280, 292)}>
        <path
          d="M215 176 Q244 152 283 173 L317 205 Q351 249 339 290 L322 344 Q279 363 230 341 L202 299 Q197 234 215 176 Z"
          fill={light}
        />
        <path
          d="M261 202 Q295 204 310 233 L313 307 L291 343 L253 335 L239 296 L242 236 Z"
          fill="#aaa59e"
        />
        <path
          d="M249 235 L307 239 M240 262 L314 263 M241 290 L310 290 M250 317 L302 317"
          stroke="#65636a"
          strokeWidth="8"
        />
        <path
          d="M214 197 L184 191 L199 219 L176 236 L204 243 L180 264 L205 276"
          fill={claw}
        />
        <path
          d="M323 207 L353 206 L339 231 L363 248 L337 261 L356 284 L331 290"
          fill={claw}
        />
        <path
          d="M219 194 L238 216 L226 252 L221 306 M311 201 L320 224 L327 270"
          fill="none"
          stroke="#242733"
          strokeWidth="7"
        />
        <g data-joint="left-arm" transform={rotateJoint(j.leftArm, 213, 233)}>
          <path
            d="M208 218 Q181 214 169 246 L157 291 L175 310 L209 296 L230 256 Z"
            fill={light}
          />
          <circle cx="196" cy="244" r="20" fill={light} />
          <path
            d="M159 285 L138 312 L167 308 L172 328 L188 306 L204 319 L209 294"
            fill={claw}
          />
          <path
            d="M176 263 L183 287 M193 264 L198 281"
            stroke="#242733"
            strokeWidth="5"
          />
        </g>
        <g data-joint="right-arm" transform={rotateJoint(j.rightArm, 320, 239)}>
          <path
            d="M314 224 Q341 216 355 244 L371 287 L352 307 L317 297 L298 255 Z"
            fill={light}
          />
          <circle cx="334" cy="245" r="20" fill={light} />
          <path
            d="M356 287 L380 305 L355 308 L346 329 L332 309 L310 321 L315 294"
            fill={claw}
          />
        </g>
        <g data-joint="head" transform={rotateJoint(j.head, 280, 195)}>
          <path
            d="M228 132 L251 108 L285 113 L319 142 L338 174 L317 198 L262 207 L224 186 Z"
            fill={light}
          />
          <path
            d="M235 131 L235 107 L253 130 L259 102 L273 129 L284 107 L294 139 L309 121 L312 151"
            fill={light}
          />
          <path
            d="M247 132 L268 164 L312 175 M260 120 L281 151 L322 161"
            stroke="#252836"
            strokeWidth="6"
            fill="none"
          />
          <path
            d="M257 170 L298 183 L328 176 L313 199 L271 205 L249 189 Z"
            fill="#54545d"
          />
          <path
            d="M264 181 L272 193 L282 187 L288 199 L299 190 L308 196 L319 183"
            fill={claw}
            strokeWidth="1.5"
          />
          <path d="M278 153 L301 163 L288 170 L278 166 Z" fill="#ffd871" />
          <path d="M288 158 L288 167" strokeWidth="3" />
          <path d="M234 145 L245 155" stroke="#ff8a68" strokeWidth="7" />
        </g>
      </g>
    </g>
  );
}

export function Kyogre({ joints: j, ink, light }: ArtModelProps) {
  return (
    <g
      stroke={ink}
      strokeWidth="3.2"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <g data-joint="tail" transform={rotateJoint(j.tail, 320, 267)}>
        <path
          d="M315 236 L371 226 L400 203 L438 198 L411 228 L451 239 L424 255 L440 285 L401 273 L377 286 L329 290 Z"
          fill={light}
        />
        <path d="M368 256 L418 240" stroke="#d5ecff" strokeWidth="9" />
      </g>
      <g data-joint="right-arm" transform={rotateJoint(j.rightArm, 282, 220)}>
        <path
          d="M272 228 L282 172 Q301 146 331 158 L374 190 L361 207 L331 218 L308 247 Z"
          fill={light}
        />
        <path
          d="M284 199 L322 187 L354 201 M306 169 L321 185 L321 207"
          stroke="#ef5969"
          strokeWidth="4"
          fill="none"
        />
        <path
          d="M326 157 L343 159 L353 177 L339 182 Z M350 170 L364 178 L375 192 L359 199 Z"
          fill="#e4f3ff"
        />
      </g>
      <g data-joint="torso" transform={rotateJoint(j.torso, 256, 263)}>
        <path
          d="M125 247 Q158 196 221 203 L282 205 Q316 219 341 253 L326 289 Q289 318 218 318 L159 299 L126 280 Z"
          fill={light}
        />
        <path
          d="M126 280 Q179 296 223 286 L266 290 L315 273 L322 292 Q272 324 221 318 L160 301 Z"
          fill="#ecf5ff"
        />
        <path d="M260 210 L281 189 L291 218" fill={light} />
        <path
          d="M153 243 Q154 211 198 214"
          stroke="#89cafa"
          strokeWidth="8"
          fill="none"
        />
        <ellipse
          cx="198"
          cy="253"
          rx="30"
          ry="16"
          fill="#e3f2ff"
          stroke="none"
          transform="rotate(-17 198 253)"
        />
        <path
          d="M262 214 L274 237 L268 258 L283 286 M292 219 L308 240 L306 270"
          fill="none"
          stroke="#ed6474"
          strokeWidth="4"
        />
        <g data-joint="head" transform={rotateJoint(j.head, 166, 260)}>
          <path
            d="M123 254 Q145 233 166 250 L179 267 L166 284 L126 281 L115 268 Z"
            fill={light}
          />
          <path
            d="M119 269 L148 272 L157 263 L171 267"
            stroke="#ed6474"
            strokeWidth="4"
          />
          <path d="M143 250 L156 250 L151 259 L141 258 Z" fill="#edce57" />
          <path d="M147 253 L151 253" strokeWidth="2" />
        </g>
      </g>
      <g data-joint="left-arm" transform={rotateJoint(j.leftArm, 223, 284)}>
        <path
          d="M215 267 Q244 250 265 270 L304 323 L317 366 L301 382 L282 367 L263 386 L245 369 L225 378 L208 363 L190 365 L177 345 L181 314 Z"
          fill={light}
        />
        <ellipse
          cx="226"
          cy="312"
          rx="25"
          ry="20"
          fill="none"
          stroke="#ef5969"
          strokeWidth="4"
        />
        <path
          d="M249 306 L282 319 L298 348 M246 323 L271 338 L279 367 M226 332 L229 361 L248 365"
          stroke="#ef5969"
          strokeWidth="4"
          fill="none"
        />
        <path
          d="M187 346 L208 349 L209 364 L191 367 Z M223 355 L242 360 L247 373 L228 381 Z M258 358 L277 365 L280 381 L266 390 Z M295 354 L311 365 L315 381 L300 385 Z"
          fill="#e3f2ff"
        />
      </g>
      <g data-joint="fin-tip" transform={rotateJoint(j.leftLeg, 257, 315)}>
        <path
          d="M240 287 Q253 283 261 291"
          stroke="#73b8ef"
          strokeWidth="7"
          fill="none"
        />
      </g>
    </g>
  );
}

export function Rayquaza({ joints: j, ink, light, accent }: ArtModelProps) {
  // Separate vertebrae change the curve itself; there is no rigid sprite rotation.
  const bend = j.tail * 0.8;
  const body = `M278 158 C${359 + bend} 171 ${382 - bend} 265 297 310 C${230 - bend} 342 ${142 + bend} 337 137 277 C132 218 ${219 - bend} 203 240 247 C${263 + bend} 292 307 357 383 375`;
  return (
    <g
      stroke={ink}
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <g data-joint="tail" transform={rotateJoint(j.rightLeg, 370, 367)}>
        <path
          d="M355 356 L393 351 L407 376 L450 421 L405 409 L387 437 L377 396 Z"
          fill={light}
        />
        <path
          d="M390 373 L411 409 M395 394 L438 420"
          stroke="#b35369"
          strokeWidth="4"
        />
      </g>
      <path
        data-joint="spine"
        data-spine-bend={bend.toFixed(3)}
        d={body}
        stroke={ink}
        strokeWidth="53"
        fill="none"
      />
      <path d={body} stroke={light} strokeWidth="45" fill="none" />
      <path
        d={body}
        stroke="#8fdec0"
        strokeWidth="5"
        fill="none"
        transform="translate(-7 -7)"
      />
      {[
        [317, 212, -21],
        [300, 293, 38],
        [180, 301, 35],
        [179, 234, -17],
        [291, 330, 40],
        [342, 365, 31],
      ].map(([x, y, a], index) => (
        <g
          key={index}
          data-joint={`vertebra-${index}`}
          transform={rotateJoint(
            (a ?? 0) + j.tail * (index % 2 ? 0.24 : -0.2),
            x!,
            y!,
          )}
        >
          <ellipse
            cx={x}
            cy={y}
            rx="18"
            ry="11"
            fill="none"
            stroke={accent}
            strokeWidth="5"
          />
          <path
            d={`M${x! + 6} ${y! - 19} l12 -22 l13 27`}
            fill={light}
            stroke="#bd586d"
            strokeWidth="3"
          />
        </g>
      ))}
      <g data-joint="torso" transform={rotateJoint(j.torso, 298, 212)}>
        <g data-joint="left-arm" transform={rotateJoint(j.leftArm, 276, 210)}>
          <path
            d="M272 199 L250 213 L241 246 L222 258 L230 277 L246 272 L262 248 L280 225 Z"
            fill={light}
          />
          <path
            d="M228 261 L218 273 L232 270 M239 268 L238 281 L246 271"
            fill="#dfefc9"
          />
        </g>
        <g data-joint="right-arm" transform={rotateJoint(j.rightArm, 316, 220)}>
          <path
            d="M311 209 L335 222 L339 246 L358 260 L347 280 L329 271 L311 247 L300 225 Z"
            fill={light}
          />
          <path
            d="M348 263 L364 270 L351 274 M337 271 L343 284 L347 275"
            fill="#dfefc9"
          />
        </g>
      </g>
      <g data-joint="head" transform={rotateJoint(j.head, 277, 166)}>
        <path
          d="M222 146 L241 115 L279 113 L313 143 L307 176 L271 196 L236 179 L215 163 Z"
          fill={light}
        />
        <path
          d="M250 129 L230 92 L213 67 L236 83 L269 121 M282 126 L319 93 L359 77 L336 103 L306 146"
          fill={light}
        />
        <path
          d="M237 156 L270 156 L288 169 L271 196 L240 185 Z"
          fill="#563746"
        />
        <path
          d="M245 160 L250 171 L259 163 L264 176 L274 169"
          fill="#f9eadb"
          strokeWidth="1.5"
        />
        <path d="M253 182 Q260 174 274 183 L267 192" fill="#ef97a4" />
        <path d="M229 146 L253 135 L264 144 L247 153 Z" fill="#282d43" />
        <path
          d="M245 141 L251 141 L248 148 L242 148 Z"
          fill="#ffde70"
          strokeWidth="1"
        />
        <ellipse
          cx="275"
          cy="125"
          rx="19"
          ry="8"
          fill="none"
          stroke={accent}
          strokeWidth="4"
        />
        <path d="M223 159 L218 173 L233 166" fill={light} />
      </g>
      <g data-joint="lower-spine" transform={rotateJoint(j.leftLeg, 206, 300)}>
        <path
          d="M199 327 L191 349 L232 349 L226 323"
          fill={light}
          stroke="#bd586d"
        />
      </g>
    </g>
  );
}
