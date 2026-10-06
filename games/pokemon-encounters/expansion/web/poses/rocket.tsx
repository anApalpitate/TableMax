import { rotateJoint as rotate, type ArtModelProps } from './art-model';
import type { PoseJoints } from './timeline';

function Human({
  female,
  joints: j,
  x,
  ink,
}: {
  female: boolean;
  joints: PoseJoints;
  x: number;
  ink: string;
}) {
  const name = female ? 'jessie' : 'james';
  const skin = '#f4d0b3',
    suit = '#f4f3f4',
    shadow = '#c6c8d4',
    boot = '#414253';
  return (
    <g
      transform={`translate(${x - 250} 0)`}
      stroke={ink}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {female && (
        <g data-joint="jessie-hair" transform={rotate(j.tail * 0.45, 251, 149)}>
          <path
            d="M225 144 Q200 107 228 91 Q247 68 283 83 Q331 91 343 140 Q362 190 384 228 Q335 214 309 178 L266 135 Z"
            fill="#b42c78"
          />
          <path
            d="M239 97 Q290 84 320 123 Q334 153 348 176"
            stroke="#ec8fba"
            strokeWidth="6"
            fill="none"
          />
          <path
            d="M261 110 Q313 131 334 184"
            stroke="#761e5b"
            strokeWidth="7"
            fill="none"
          />
        </g>
      )}
      <g
        data-joint={`${name}-left-leg`}
        transform={rotate(female ? j.leftLeg : -j.leftLeg * 0.6, 235, 278)}
      >
        <path
          d="M222 271 L247 274 L244 334 L226 395 L209 391 L222 333 Z"
          fill={female ? skin : suit}
        />
        <path
          d="M216 345 L238 350 L226 408 L224 436 L206 452 L192 449 L210 429 L206 408 Z"
          fill={boot}
        />
        <path d="M218 373 L226 354" stroke="#727286" strokeWidth="3" />
      </g>
      <g
        data-joint={`${name}-right-leg`}
        transform={rotate(female ? j.rightLeg : -j.rightLeg * 0.6, 272, 278)}
      >
        <path
          d="M258 272 L281 270 L286 333 L299 395 L280 401 L267 345 Z"
          fill={female ? skin : suit}
        />
        <path
          d="M271 349 L291 345 L301 407 L311 432 Q316 446 306 451 L277 449 L272 438 L284 431 L274 407 Z"
          fill={boot}
        />
        <path d="M285 367 L295 407" stroke="#727286" strokeWidth="3" />
      </g>
      <g
        data-joint={`${name}-torso`}
        transform={rotate(female ? j.torso : -j.torso * 0.75, 253, 237)}
      >
        <path
          d="M237 165 L267 165 L281 198 L278 243 L257 262 L225 247 L224 192 Z"
          fill="#333443"
        />
        <path
          d="M226 177 L243 169 L249 190 L265 171 L280 181 L286 221 L268 239 L227 235 L215 220 L216 191 Z"
          fill={suit}
        />
        <path
          d="M241 177 L238 206 L227 216 M271 181 L278 210 L271 223"
          fill="none"
          stroke={shadow}
          strokeWidth="3"
        />
        <path
          d="M240 190 L253 190 Q266 191 264 202 Q263 208 258 210 L269 225 L258 225 L250 212 L249 225 L240 225 Z M249 197 L249 205 L254 205 Q259 201 254 197 Z"
          fill="#df5270"
          fillRule="evenodd"
          stroke="none"
        />
        {female ? (
          <>
            <path d="M229 234 L269 236 L271 254 L225 252 Z" fill={skin} />
            <path
              d="M222 249 L276 250 L284 281 L267 290 L247 283 L225 289 L213 278 Z"
              fill={suit}
            />
            <path
              d="M238 257 L233 281 M263 258 L272 282"
              stroke={shadow}
              strokeWidth="2"
            />
          </>
        ) : (
          <>
            <path d="M223 234 L277 235 L281 259 L220 259 Z" fill={boot} />
            <path
              d="M224 255 L278 255 L284 284 L256 294 L222 283 Z"
              fill={suit}
            />
            <path d="M258 264 L256 291" stroke={shadow} strokeWidth="2" />
          </>
        )}
        <g
          data-joint={`${name}-left-arm`}
          transform={rotate(female ? j.leftArm : j.rightArm * 0.72, 222, 194)}
        >
          <path
            d="M222 181 Q207 180 201 196 L195 225 L210 238 L225 208 Z"
            fill={suit}
          />
          <path
            d="M200 211 L214 220 L205 248 L184 271 L171 261 L190 238 Z"
            fill={skin}
          />
          <path
            d="M185 253 L197 266 L182 282 L179 302 L170 308 L159 298 L158 286 L171 271 Z"
            fill={boot}
          />
          <path
            d="M164 287 L165 299 M171 289 L172 303"
            stroke="#8b8b9b"
            strokeWidth="1"
          />
        </g>
        <g
          data-joint={`${name}-right-arm`}
          transform={rotate(
            female ? j.rightArm * 0.66 : j.leftArm * 0.9,
            280,
            194,
          )}
        >
          <path
            d="M272 179 Q288 180 295 196 L302 220 L288 234 L272 206 Z"
            fill={suit}
          />
          <path
            d="M291 211 L303 220 L322 242 L313 258 L290 242 L282 226 Z"
            fill={skin}
          />
          <path
            d="M312 246 L325 241 L338 260 L357 267 L359 278 L346 284 L330 277 L318 268 Z"
            fill={boot}
          />
          <path
            d="M344 271 L356 271 M342 276 L353 278"
            stroke="#8b8b9b"
            strokeWidth="1"
          />
        </g>
        <g
          data-joint={`${name}-head`}
          transform={rotate(female ? j.head : -j.head * 0.7, 252, 162)}
        >
          {!female && (
            <path
              d="M220 142 Q209 110 229 90 Q253 76 278 93 Q298 114 281 155 L268 168 L232 164 Z"
              fill="#777eaf"
            />
          )}
          <path
            d="M229 110 Q251 96 276 115 L273 143 L262 158 L259 172 L242 173 L239 159 L226 145 Z"
            fill={skin}
          />
          {female ? (
            <>
              <path
                d="M221 123 Q210 108 228 99 Q247 83 276 96 L287 110 L267 119 L246 114 L234 128 Z"
                fill="#b42c78"
              />
              <path
                d="M223 109 Q245 92 266 102"
                stroke="#ed8cb9"
                strokeWidth="5"
              />
              <ellipse cx="230" cy="157" rx="4" ry="6" fill="#69ab82" />
              <ellipse cx="274" cy="156" rx="4" ry="6" fill="#69ab82" />
            </>
          ) : (
            <>
              <path
                d="M219 130 L221 102 L236 91 L254 102 L273 95 L285 111 L284 142 L273 155 L274 121 L259 112 L249 127 L242 106 L228 131 Z"
                fill="#858bbe"
              />
              <path
                d="M229 99 L237 100 L241 114"
                stroke="#d8dcf4"
                strokeWidth="5"
                fill="none"
              />
            </>
          )}
          <path
            d="M232 129 L245 132 L237 137 Z M258 131 L269 128 L266 137 Z"
            fill="#fff6ec"
            strokeWidth="1"
          />
          <path
            d="M239 133 L239 136 M264 132 L264 136"
            stroke="#4a8185"
            strokeWidth="2"
          />
          <path d="M252 132 L248 145 L253 146" fill="none" strokeWidth="1" />
          <path
            d="M245 153 Q253 157 260 152"
            stroke={female ? '#be476c' : ink}
            strokeWidth="1.5"
            fill="none"
          />
          <path d="M233 125 L245 129 M258 128 L269 124" strokeWidth="1.5" />
        </g>
      </g>
    </g>
  );
}

function Meowth({ joints: j, ink, accent }: ArtModelProps) {
  const cream = '#ffe6b4';
  return (
    <g
      stroke={ink}
      strokeWidth="2.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <g data-joint="meowth-tail" transform={rotate(j.tail, 282, 382)}>
        <path
          d="M277 379 Q326 402 332 371 Q338 349 324 355 Q314 360 325 367"
          fill="none"
          stroke={ink}
          strokeWidth="14"
        />
        <path
          d="M277 379 Q326 402 332 371 Q338 349 324 355 Q314 360 325 367"
          fill="none"
          stroke="#d99a68"
          strokeWidth="9"
        />
      </g>
      <g data-joint="meowth-left-leg" transform={rotate(j.leftLeg, 245, 379)}>
        <path
          d="M239 369 L257 374 L249 406 L230 417 L212 413 L210 403 L231 398 Z"
          fill={cream}
        />
        <path
          d="M214 400 L235 398 L239 413 L221 421 L208 412 Z"
          fill="#d99a68"
        />
      </g>
      <g data-joint="meowth-right-leg" transform={rotate(j.rightLeg, 278, 378)}>
        <path
          d="M264 369 L282 368 L291 398 L312 403 L314 414 L295 421 L277 407 Z"
          fill={cream}
        />
        <path
          d="M290 398 L309 400 L319 410 L309 421 L290 415 Z"
          fill="#d99a68"
        />
      </g>
      <g data-joint="meowth-torso" transform={rotate(j.torso, 262, 354)}>
        <path
          d="M242 317 L278 317 Q294 340 291 367 Q277 389 255 385 Q233 378 229 357 Z"
          fill={cream}
        />
        <ellipse
          cx="260"
          cy="349"
          rx="18"
          ry="23"
          fill="#fff2d1"
          stroke="none"
        />
        <g data-joint="meowth-left-arm" transform={rotate(j.leftArm, 240, 336)}>
          <path
            d="M240 326 L228 326 L214 339 L196 335 L188 344 L196 359 L216 356 L240 347 Z"
            fill={cream}
          />
          <path
            d="M190 342 L201 350 M194 337 L206 343"
            stroke="#c69972"
            strokeWidth="1.5"
          />
        </g>
        <g
          data-joint="meowth-right-arm"
          transform={rotate(j.rightArm, 283, 335)}
        >
          <path
            d="M278 325 L292 327 L309 340 L328 335 L338 345 L330 360 L308 355 L283 347 Z"
            fill={cream}
          />
          <path
            d="M329 341 L319 350 M333 347 L322 355"
            stroke="#c69972"
            strokeWidth="1.5"
          />
        </g>
        <g data-joint="meowth-head" transform={rotate(j.head, 262, 317)}>
          <path
            d="M227 270 L219 240 L244 253 L281 252 L303 240 L298 272 Q311 300 291 318 Q266 334 238 320 Q214 306 227 270 Z"
            fill={cream}
          />
          <path
            d="M225 248 L231 270 L243 260 Z M296 249 L291 270 L279 260 Z"
            fill="#cc8890"
          />
          <ellipse cx="244" cy="287" rx="10" ry="16" fill="#fff" />
          <ellipse cx="281" cy="287" rx="10" ry="16" fill="#fff" />
          <ellipse cx="247" cy="288" rx="3" ry="12" fill="#44709a" />
          <ellipse cx="278" cy="288" rx="3" ry="12" fill="#44709a" />
          <path
            d="M244 307 Q262 300 280 308 Q264 329 248 318 Z"
            fill="#bd5c70"
          />
          <path d="M251 309 L260 309 L257 313" fill="#fff" stroke="none" />
          <path d="M255 301 L263 300 L269 303 L264 307 Z" fill="#b28169" />
          <path
            d="M230 283 L204 273 M227 294 L199 299 M296 282 L320 269 M298 294 L326 297"
            strokeWidth="2"
          />
          <g
            data-joint="meowth-coin"
            transform={rotate(j.tail * 0.22, 261, 260)}
          >
            <ellipse cx="261" cy="259" rx="9" ry="22" fill={accent} />
            <path
              d="M254 247 L267 244 M253 256 L269 254 M253 265 L269 263 M256 273 L266 271"
              stroke="#ad7930"
              strokeWidth="2"
            />
          </g>
        </g>
      </g>
    </g>
  );
}

export function Rocket(props: ArtModelProps) {
  return (
    <g>
      <Human female joints={props.joints} x={168} ink={props.ink} />
      <Human female={false} joints={props.joints} x={334} ink={props.ink} />
      <Meowth {...props} />
    </g>
  );
}
