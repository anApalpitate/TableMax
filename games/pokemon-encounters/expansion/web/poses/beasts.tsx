import { rotateJoint as rotate, type ArtModelProps } from './art-model';

export function Greninja({
  joints: j,
  ink,
  light,
  accent,
  progress,
}: ArtModelProps) {
  const bonded = progress >= 0.3;
  return (
    <g
      stroke={ink}
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <g data-joint="tongue-scarf" transform={rotate(j.tail, 254, 206)}>
        <path
          d={`M258 195 C197 174 ${158 + j.tail} 160 111 187 Q93 199 104 210 Q132 220 150 205 C188 200 213 225 263 221 Z`}
          fill="#e991a4"
        />
        <path
          d="M137 192 Q184 179 226 202"
          stroke="#ffc5cf"
          strokeWidth="6"
          fill="none"
        />
      </g>
      {bonded && (
        <g
          data-joint="water-shuriken"
          transform={rotate(j.tail * 2, 270, 258)}
          opacity=".72"
        >
          <path
            d="M270 161 L291 229 L366 240 L302 274 L289 351 L260 287 L183 269 L245 237 Z"
            fill="#5cc9ef"
            stroke="#c8f6ff"
            strokeWidth="5"
          />
          <path
            d="M270 204 L281 241 L320 251 L284 266 L277 306 L261 273 L222 260 L257 245 Z"
            fill="#b9f5ff"
            stroke="none"
          />
        </g>
      )}
      <g data-joint="left-leg" transform={rotate(j.leftLeg, 232, 310)}>
        <path
          d="M232 296 Q194 303 186 339 L160 375 L176 390 L212 365 L253 329 Z"
          fill={light}
        />
        <path
          d="M174 383 L152 405 L111 418 Q99 427 114 436 L149 434 L168 423 L187 430 Q203 426 194 416 L190 395 Z"
          fill={light}
        />
        <path d="M168 398 L153 420 L167 416" fill="#e8e4ac" />
      </g>
      <g data-joint="right-leg" transform={rotate(j.rightLeg, 282, 309)}>
        <path
          d="M272 300 Q311 300 323 332 L347 359 L334 379 L302 361 L259 329 Z"
          fill={light}
        />
        <path
          d="M335 369 L352 396 L382 407 Q399 416 388 425 L361 423 L346 418 L328 428 Q312 429 312 418 L321 395 Z"
          fill={light}
        />
        <path d="M339 390 L353 410 L337 405" fill="#e8e4ac" />
      </g>
      <g data-joint="torso" transform={rotate(j.torso, 259, 279)}>
        <path
          d="M238 207 L282 211 L297 251 L283 308 L257 338 L220 313 L223 264 Z"
          fill={light}
        />
        <path
          d="M243 222 L269 221 L281 263 L264 294 L256 323 L244 286 L227 273 Z"
          fill="#e2e1a2"
        />
        <g data-joint="left-arm" transform={rotate(j.leftArm, 234, 237)}>
          <path
            d="M230 223 Q208 216 193 242 L166 279 L146 288 L147 304 L171 303 L206 277 L246 247 Z"
            fill={light}
          />
          <ellipse cx="211" cy="243" rx="18" ry="14" fill="#f0f3f8" />
          <path
            d="M157 294 L128 301 L115 320 L129 324 L145 308 L139 327 L153 329 L164 309 L175 320 L185 312 L168 295 Z"
            fill={light}
          />
          <path d="M144 307 L157 310" stroke="#e4e0aa" strokeWidth="5" />
        </g>
        <g data-joint="right-arm" transform={rotate(j.rightArm, 283, 236)}>
          <path
            d="M278 223 Q303 221 315 243 L344 269 L359 270 L370 289 L359 301 L336 290 L299 274 L269 247 Z"
            fill={light}
          />
          <ellipse cx="302" cy="242" rx="18" ry="14" fill="#f0f3f8" />
          <path
            d="M359 280 L389 272 L405 281 L399 291 L383 286 L406 300 L402 310 L374 298 L385 318 L373 323 L356 302 L345 299 Z"
            fill={light}
          />
          <path d="M373 291 L383 299" stroke="#e4e0aa" strokeWidth="5" />
        </g>
        <g data-joint="head" transform={rotate(j.head, 259, 209)}>
          <path
            d="M216 152 L206 114 L244 146 L276 141 L307 118 L299 168 L278 203 L255 221 L224 204 L208 175 Z"
            fill={light}
          />
          <path
            d="M237 165 L243 105 L259 148 L271 93 L282 155 L270 188 L257 208 Z"
            fill={bonded ? '#e96d72' : light}
          />
          <path
            d="M214 159 L236 174 L256 207 L228 196 L213 181 Z M282 165 L294 157 L294 181 L269 201 Z"
            fill="#efeba9"
          />
          <path
            d="M218 170 L232 176 L225 187 Z M290 171 L280 179 L287 185 Z"
            fill="#f8fdff"
          />
          <path
            d="M225 178 L227 182 M285 176 L284 181"
            stroke="#ae5157"
            strokeWidth="4"
          />
          <path d="M246 214 L264 212" stroke="#59647e" strokeWidth="2" />
          <path d="M251 155 L250 183" stroke="#76acd4" strokeWidth="5" />
        </g>
      </g>
      <g data-joint="focus-knee" transform={rotate(j.tail / 2, 251, 310)}>
        <ellipse cx="239" cy="301" rx="14" ry="10" fill="#f1f4f8" />
      </g>
      <path
        d="M112 186 Q94 190 100 207"
        fill="none"
        stroke={accent}
        strokeWidth="3"
      />
    </g>
  );
}

export function Lucario({ joints: j, ink, light, accent }: ArtModelProps) {
  return (
    <g
      stroke={ink}
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <g data-joint="tail" transform={rotate(j.tail, 285, 323)}>
        <path
          d="M280 320 Q339 325 369 276 L390 286 L372 293 Q340 349 293 348 Z"
          fill={light}
        />
      </g>
      <g data-joint="left-leg" transform={rotate(j.leftLeg, 231, 326)}>
        <path
          d="M230 306 Q203 310 205 346 L201 377 L181 414 Q179 432 197 439 L221 433 L227 404 L242 357 L259 329 Z"
          fill={light}
        />
        <path
          d="M207 365 L234 371 L223 413 L224 434 L218 445 L183 444 Q173 437 183 422 L196 415 Z"
          fill="#41475b"
        />
        <path
          d="M189 430 L194 439 M204 427 L208 438"
          stroke="#737f98"
          strokeWidth="2"
        />
      </g>
      <g data-joint="right-leg" transform={rotate(j.rightLeg, 287, 326)}>
        <path
          d="M270 305 Q304 308 313 342 L320 385 L332 416 L310 432 L288 402 L272 362 L251 329 Z"
          fill={light}
        />
        <path
          d="M289 371 L316 368 L323 403 L340 422 Q346 436 337 444 L307 445 L299 437 L296 411 Z"
          fill="#41475b"
        />
        <path
          d="M317 426 L314 440 M330 429 L328 440"
          stroke="#737f98"
          strokeWidth="2"
        />
      </g>
      <g data-joint="torso" transform={rotate(j.torso, 260, 284)}>
        <path
          d="M229 216 L285 217 L297 264 L285 305 L267 337 L244 338 L226 315 L218 269 Z"
          fill="#343d52"
        />
        <path
          d="M238 222 L252 214 L274 221 L281 251 L288 263 L278 273 L285 295 L271 310 L267 331 L256 323 L240 334 L240 313 L226 301 L234 280 L225 263 L238 249 Z"
          fill={accent}
        />
        <path
          d="M252 255 L258 236 L268 255 L267 268 L253 268 Z"
          fill="#f8f5ec"
        />
        <g data-joint="left-arm" transform={rotate(j.leftArm, 229, 238)}>
          <path
            d="M225 225 L210 226 L192 259 L164 283 L173 302 L207 279 L240 248 Z"
            fill={light}
          />
          <path
            d="M171 279 Q153 273 144 290 L139 311 L158 327 L180 318 L185 299 Z"
            fill="#3e4556"
          />
          <path d="M150 299 L151 273 L166 294 Z" fill="#f1f2f7" />
          <path d="M144 308 L170 312" stroke="#77839b" strokeWidth="3" />
        </g>
        <g data-joint="right-arm" transform={rotate(j.rightArm, 286, 236)}>
          <path
            d="M282 225 L300 227 L322 257 L350 273 L344 296 L310 278 L275 249 Z"
            fill={light}
          />
          <path
            d="M344 271 Q363 264 371 280 L378 303 L362 323 L342 315 L334 294 Z"
            fill="#3e4556"
          />
          <path d="M354 284 L367 263 L371 289 Z" fill="#f1f2f7" />
          <path d="M354 310 L374 302" stroke="#77839b" strokeWidth="3" />
        </g>
        <g data-joint="head" transform={rotate(j.head, 258, 216)}>
          <path
            d="M219 131 L214 88 L244 119 L265 116 L284 85 L293 133 L289 179 L270 202 L240 207 L214 183 Z"
            fill={light}
          />
          <path
            d="M222 123 L218 100 L235 124 Z M274 123 L284 99 L285 129 Z"
            fill="#263447"
          />
          <path
            d="M231 173 L209 217 Q200 238 214 245 L233 230 L247 191 M274 175 L296 211 Q305 233 292 241 L275 226 L262 189"
            fill="#363c50"
          />
          <path
            d="M215 150 L235 150 L253 164 L272 145 L292 149 L279 179 L260 187 L239 178 L213 174 Z"
            fill="#3c4053"
          />
          <path
            d="M217 169 L241 161 L259 183 L244 196 L221 195 L205 185 Z"
            fill="#343c4d"
          />
          <path
            d="M237 154 L251 162 L242 171 Z M275 154 L262 165 L273 171 Z"
            fill="#e77668"
          />
          <path
            d="M242 160 L244 165 M270 160 L268 165"
            stroke="#f9eccb"
            strokeWidth="2"
          />
          <path d="M225 193 L243 193" stroke="#7487a3" strokeWidth="2" />
          <path d="M235 122 L245 143" stroke="#96daea" strokeWidth="6" />
        </g>
      </g>
    </g>
  );
}

export function Charizard({ joints: j, ink, light, accent }: ArtModelProps) {
  return (
    <g
      stroke={ink}
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <g data-joint="tail" transform={rotate(j.tail, 288, 349)}>
        <path
          d="M278 343 Q359 391 389 323 L409 292 Q402 354 375 376 Q333 412 289 378 Z"
          fill={light}
        />
        <path
          d="M392 315 Q366 287 387 258 L387 280 L405 244 L405 272 L424 255 Q446 293 416 317 Z"
          fill="#f78439"
          stroke="#eb7231"
        />
        <path
          d="M396 305 Q383 287 399 273 L403 292 L419 276 Q423 303 407 309 Z"
          fill="#ffe882"
          stroke="none"
        />
      </g>
      <g data-joint="left-wing" transform={rotate(j.leftArm * 0.42, 231, 228)}>
        <path
          d="M226 251 L175 236 L130 280 L111 259 L92 288 L92 210 L144 163 L168 135 L175 180 L215 208 Z"
          fill={light}
        />
        <path
          d="M168 179 L128 195 L101 221 L102 263 L118 241 L137 262 L171 227 L206 225 Z"
          fill="#328d9c"
        />
        <path
          d="M168 183 L169 225 M169 187 L112 240"
          stroke="#176676"
          strokeWidth="3"
        />
      </g>
      <g
        data-joint="right-wing"
        transform={rotate(j.rightArm * 0.42, 282, 228)}
      >
        <path
          d="M281 251 L327 237 L370 279 L389 256 L410 285 L412 208 L361 162 L342 135 L334 181 L293 206 Z"
          fill={light}
        />
        <path
          d="M340 178 L379 194 L402 219 L401 261 L385 240 L368 261 L336 226 L301 224 Z"
          fill="#328d9c"
        />
        <path
          d="M340 182 L337 226 M341 186 L391 242"
          stroke="#176676"
          strokeWidth="3"
        />
      </g>
      <g data-joint="left-leg" transform={rotate(j.leftLeg, 224, 337)}>
        <path
          d="M223 314 Q183 325 184 360 L166 401 L185 426 L225 422 L231 390 L256 347 Z"
          fill={light}
        />
        <path
          d="M172 410 L160 435 L181 424 L190 441 L204 421 L220 439 L226 415"
          fill="#fff5d6"
        />
      </g>
      <g data-joint="right-leg" transform={rotate(j.rightLeg, 293, 336)}>
        <path
          d="M289 314 Q329 320 335 355 L352 402 L336 426 L294 421 L287 389 L267 344 Z"
          fill={light}
        />
        <path
          d="M297 414 L292 439 L312 422 L326 440 L338 422 L358 433 L346 408"
          fill="#fff5d6"
        />
      </g>
      <g data-joint="torso" transform={rotate(j.torso, 260, 296)}>
        <path
          d="M234 193 L272 194 Q278 240 291 258 Q326 301 306 352 Q280 391 234 373 Q198 357 207 316 L230 256 Z"
          fill={light}
        />
        <path
          d="M247 211 L263 212 Q267 255 278 269 Q311 306 290 346 Q271 366 240 359 Q215 342 223 312 L242 265 Z"
          fill={accent}
        />
        <g data-joint="left-arm" transform={rotate(j.leftArm, 227, 258)}>
          <path
            d="M227 244 L207 249 L185 273 L164 277 L158 295 L171 307 L192 301 L213 286 L238 271 Z"
            fill={light}
          />
          <path
            d="M162 288 L148 304 L162 302 L166 317 L178 303 L190 312 L193 292"
            fill={light}
          />
          <path
            d="M149 302 L153 291 L157 304 M167 315 L171 306 L177 317 M187 311 L189 301 L195 313"
            fill="#fff6d6"
          />
        </g>
        <g data-joint="right-arm" transform={rotate(j.rightArm, 288, 257)}>
          <path
            d="M283 245 L303 247 L327 272 L350 278 L358 295 L345 309 L326 302 L302 286 L275 270 Z"
            fill={light}
          />
          <path
            d="M351 285 L367 302 L355 304 L347 319 L335 305 L320 312 L319 293"
            fill={light}
          />
          <path
            d="M364 300 L362 289 L369 302 M346 315 L343 305 L338 318 M322 309 L323 301 L316 311"
            fill="#fff6d6"
          />
        </g>
        <g data-joint="head" transform={rotate(j.head, 254, 190)}>
          <path
            d="M230 166 L230 121 L246 104 L256 117 L275 102 L281 133 L303 148 L319 169 L298 187 L279 203 L250 206 Z"
            fill={light}
          />
          <path
            d="M241 117 L238 92 L253 107 M270 112 L280 91 L281 133"
            fill={light}
          />
          <path
            d="M270 163 L302 155 L317 171 L294 185 L270 186 L252 180 Z"
            fill={light}
          />
          <path d="M272 177 L302 176 L293 190 L273 193 Z" fill="#633849" />
          <path d="M282 176 L286 185 L291 176" fill="#fff9e9" strokeWidth="1" />
          <path d="M260 144 L280 150 L269 157 L260 154 Z" fill="#ecfaff" />
          <path d="M270 149 L270 155" stroke="#2a8197" strokeWidth="4" />
          <path d="M241 136 L240 158" stroke="#ffd58d" strokeWidth="5" />
        </g>
      </g>
    </g>
  );
}

export function Snorlax({ joints: j, ink, light, accent }: ArtModelProps) {
  return (
    <g
      stroke={ink}
      strokeWidth="3.2"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <g data-joint="left-arm" transform={rotate(j.leftArm, 194, 263)}>
        <path
          d="M202 242 Q157 227 126 264 L106 301 Q98 320 118 329 L154 323 L197 294 Z"
          fill={light}
        />
        <path
          d="M108 313 L103 337 L119 329 L125 341 L138 326 L147 337 L158 319"
          fill="#fbf3df"
        />
      </g>
      <g data-joint="right-arm" transform={rotate(j.rightArm, 323, 266)}>
        <path
          d="M313 245 Q360 229 388 266 L409 302 Q414 322 396 329 L360 322 L320 296 Z"
          fill={light}
        />
        <path
          d="M366 320 L375 337 L390 326 L399 339 L412 332 L408 312"
          fill="#fbf3df"
        />
      </g>
      <g data-joint="torso" transform={rotate(j.torso, 260, 310)}>
        <path
          d="M177 224 Q261 192 337 231 Q379 280 367 362 Q337 424 264 429 Q184 428 147 380 Q139 312 177 224 Z"
          fill={light}
        />
        <path
          d="M204 251 Q263 226 318 259 Q354 305 340 361 Q317 394 266 398 Q208 397 175 360 Q170 301 204 251 Z"
          fill={accent}
        />
        <path
          d="M189 289 Q190 268 219 264"
          stroke="#fff4d6"
          strokeWidth="9"
          fill="none"
        />
        <g data-joint="head" transform={rotate(j.head, 258, 228)}>
          <path
            d="M190 156 L184 119 L214 132 Q259 115 300 134 L327 117 L326 163 Q346 200 319 230 Q263 260 205 237 Q176 211 190 156 Z"
            fill={light}
          />
          <path
            d="M196 175 L224 158 L252 183 L282 159 L314 175 Q335 212 303 231 Q259 249 213 231 Q179 213 196 175 Z"
            fill={accent}
          />
          <path
            d="M210 201 Q222 207 236 203 M278 204 Q291 210 304 202"
            fill="none"
            strokeWidth="2.5"
          />
          <path d="M239 223 Q259 230 279 222" fill="none" strokeWidth="2" />
          <path
            d="M236 225 L239 216 L242 224 M276 224 L279 215 L282 222"
            fill="#fff"
            strokeWidth="1.5"
          />
        </g>
      </g>
      <g data-joint="left-leg" transform={rotate(j.leftLeg, 196, 387)}>
        <ellipse cx="190" cy="395" rx="46" ry="43" fill={accent} />
        <ellipse cx="190" cy="408" rx="26" ry="23" fill="#8f8175" />
        <path
          d="M153 381 L152 356 L170 375 M184 369 L192 344 L199 370 M213 377 L229 355 L230 386"
          fill="#fff9e9"
        />
      </g>
      <g data-joint="right-leg" transform={rotate(j.rightLeg, 322, 389)}>
        <ellipse cx="326" cy="396" rx="46" ry="43" fill={accent} />
        <ellipse cx="326" cy="409" rx="26" ry="23" fill="#8f8175" />
        <path
          d="M288 384 L287 359 L304 375 M320 370 L328 345 L335 370 M350 378 L364 356 L366 387"
          fill="#fff9e9"
        />
      </g>
      <g data-joint="shoulder-shift" transform={rotate(j.tail, 258, 280)}>
        <path
          d="M227 271 Q258 259 286 275"
          fill="none"
          stroke="#eee0c4"
          strokeWidth="3"
        />
      </g>
    </g>
  );
}
