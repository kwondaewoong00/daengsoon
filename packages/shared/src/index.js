/**
 * 클라이언트(브라우저)와 서버가 "같은 언어"로 대화하기 위한 약속(프로토콜).
 * 양쪽이 이 파일을 함께 쓰기 때문에, 메시지 모양이 어긋나면 컴파일 단계에서 바로 잡힙니다.
 */
export const MAX_INTENSITY = 1;
export const MIN_INTENSITY = 0.15;
/** 장작 하나가 더해주는 세기 */
export const POKE_BOOST = 0.18;
/** 초당 자연 감소량 (장작은 타서 사그라든다) */
export const DECAY_PER_SECOND = 0.02;
