import { useState, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Billboard, Text } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Content } from '../../types'
import RecommendationCard from '../../components/RecommendationCard'

// 장르별 '성단(Cluster)'의 중심 좌표 설정 (3D 공간 배치)
const GENRE_CLUSTERS: Record<string, [number, number, number]> = {
  '액션': [10, 0, 0],
  'Action': [10, 0, 0],
  '로맨스': [-10, 5, 0],
  'Romance': [-10, 5, 0],
  '공포': [0, -10, 5],
  'Horror': [0, -10, 5],
  '호러': [0, -10, 5],
  '코미디': [5, 5, 10],
  'Comedy': [5, 5, 10],
  'SF': [-5, -5, -10],
  'Sci-Fi': [-5, -5, -10],
  'Science Fiction': [-5, -5, -10],
  '애니메이션': [0, 10, -5],
  'Animation': [0, 10, -5],
  '드라마': [8, -8, 0],
  'Drama': [8, -8, 0],
  '판타지': [-8, 0, 8],
  'Fantasy': [-8, 0, 8],
  'default': [0, 0, 0],
}

// 색상 팔레트 (장르별 별 색상)
const GENRE_COLORS: Record<string, string> = {
  '액션': '#ff4b4b', // Red
  'Action': '#ff4b4b',
  '로맨스': '#ffb6c1', // Pink
  'Romance': '#ffb6c1',
  '공포': '#4a0000', // Dark Red
  'Horror': '#4a0000',
  '호러': '#4a0000',
  '코미디': '#ffd700', // Yellow
  'Comedy': '#ffd700',
  'SF': '#00ffff', // Cyan
  'Sci-Fi': '#00ffff',
  'Science Fiction': '#00ffff',
  '애니메이션': '#9b59b6', // Purple
  'Animation': '#9b59b6',
  '드라마': '#8fd19e', // Green
  'Drama': '#8fd19e',
  '판타지': '#9b59b6', // Purple
  'Fantasy': '#9b59b6',
  'default': '#ffffff',
}

// 콘텐츠에서 주요 장르 추출 (tags 또는 genres 배열 사용)
function getPrimaryGenre(content: Content): string {
  // tags 배열이 있으면 첫 번째 태그 사용
  if (content.tags && content.tags.length > 0) {
    const firstTag = content.tags[0]
    // "Action & Adventure" 같은 경우 "Action"만 추출
    return firstTag.split('&')[0].trim()
  }
  // genres 배열이 있으면 첫 번째 장르 사용
  if (content.genres && content.genres.length > 0) {
    return content.genres[0]
  }
  // genre 필드 사용 (예: '영화', '드라마', '애니메이션', '예능')
  if (content.genre) {
    return content.genre
  }
  return 'default'
}

function MovieStar({
  content,
  position,
  color,
  onClick,
  isSelected,
}: {
  content: Content
  position: [number, number, number]
  color: string
  onClick: (content: Content, pos: [number, number, number]) => void
  isSelected: boolean
}) {
  const ref = useRef<THREE.Mesh>(null)
  const [hovered, setHover] = useState(false)

  // 별이 반짝이는 애니메이션
  useFrame((state) => {
    if (ref.current) {
      const t = state.clock.getElapsedTime()
      // 크기 진동 (반짝임 효과)
      const scale = isSelected ? 1.5 : hovered ? 1.2 : 1 + Math.sin(t * 2 + position[0]) * 0.2
      ref.current.scale.setScalar(scale)
    }
  })

  return (
    <group position={position}>
      {/* 별 (Mesh) */}
      <mesh
        ref={ref}
        onClick={(e) => {
          e.stopPropagation()
          onClick(content, position)
        }}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <sphereGeometry args={[0.3, 16, 16]} /> {/* 별 크기 */}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected || hovered ? 2 : 0.5}
          toneMapped={false}
        />
      </mesh>

      {/* 호버 시 나타나는 텍스트 라벨 (Billboard: 항상 카메라를 봄) */}
      {(hovered || isSelected) && (
        <Billboard position={[0, 0.8, 0]}>
          <Text
            fontSize={0.5}
            color="white"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            {content.title}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

// 카메라 컨트롤러 (선택 시 해당 위치로 이동)
function CameraController({ target }: { target: [number, number, number] | null }) {
  useFrame((state) => {
    if (target) {
      // 부드럽게 타겟 위치로 이동 (Lerp)
      // 카메라 위치: 타겟에서 z축으로 5만큼 떨어진 곳
      state.camera.position.lerp(new THREE.Vector3(target[0], target[1], target[2] + 8), 0.05)
      state.camera.lookAt(target[0], target[1], target[2])
    }
  })
  return (
    <OrbitControls
      enableZoom={true}
      enablePan={true}
      autoRotate={!target}
      autoRotateSpeed={0.5}
    />
  )
}

export default function Universe() {
  const navigate = useNavigate()
  const [contents, setContents] = useState<Content[]>([])
  const [selectedContent, setSelectedContent] = useState<Content | null>(null)
  const [targetPosition, setTargetPosition] = useState<[number, number, number] | null>(null)

  // 데이터 로드
  useEffect(() => {
    const fetchContents = async () => {
      try {
        // 100개 정도의 영화를 가져옵니다 (시각적 풍성함을 위해)
        const { data, error } = await supabase.from('contents').select('*').limit(100)

        if (error) {
          console.error('콘텐츠 로드 실패:', error)
          return
        }

        if (data) {
          setContents(data)
        }
      } catch (error) {
        console.error('콘텐츠 로드 중 오류:', error)
      }
    }
    fetchContents()
  }, [])

  // 각 영화의 3D 좌표 계산 (한 번만 실행)
  const stars = useMemo(() => {
    return contents.map((content) => {
      const genre = getPrimaryGenre(content)
      // 기본 장르 중심점 가져오기
      const center = GENRE_CLUSTERS[genre] || GENRE_CLUSTERS['default']

      // 중심점 주변에 랜덤하게 분포 (Random Spread)
      // Math.random() - 0.5 로 -0.5 ~ 0.5 범위 생성 후 확산
      const spread = 5 // 확산 범위
      const x = center[0] + (Math.random() - 0.5) * spread
      const y = center[1] + (Math.random() - 0.5) * spread
      const z = center[2] + (Math.random() - 0.5) * spread

      const color = GENRE_COLORS[genre] || GENRE_COLORS['default']

      return {
        content,
        position: [x, y, z] as [number, number, number],
        color,
      }
    })
  }, [contents])

  const handleStarClick = (content: Content, pos: [number, number, number]) => {
    setSelectedContent(content)
    setTargetPosition(pos)
  }

  const handleBackgroundClick = () => {
    setSelectedContent(null)
    setTargetPosition(null)
  }

  return (
    <div className="w-full h-screen bg-black relative overflow-hidden font-pretendard">
      {/* 3D Canvas */}
      <Canvas camera={{ position: [0, 0, 25], fov: 60 }}>
        {/* 배경 별 (먼 배경) */}
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

        {/* 조명 */}
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />

        {/* 빛번짐 효과 (Bloom) */}
        {/* 별들의 emissive(발광) 속성과 반응하여 빛나게 만듭니다 */}
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.1} // 이 밝기 이상인 픽셀만 빛나게 함 (0~1)
            luminanceSmoothing={0.9} // 경계를 부드럽게 처리
            intensity={3.0} // 빛 번짐 강도 (높을수록 강렬함)
            mipmapBlur={true} // 고퀄리티 블러 효과 사용
          />
        </EffectComposer>

        {/* 영화 별들 */}
        {stars.map((star) => (
          <MovieStar
            key={star.content.id}
            content={star.content}
            position={star.position}
            color={star.color}
            onClick={handleStarClick}
            isSelected={selectedContent?.id === star.content.id}
          />
        ))}

        {/* 카메라 컨트롤 & 인터랙션 */}
        <CameraController target={targetPosition} />

        {/* 빈 공간 클릭 시 선택 해제용 투명 mesh */}
        <mesh
          visible={false}
          onClick={handleBackgroundClick}
          scale={[100, 100, 100]}
        >
          <sphereGeometry />
        </mesh>
      </Canvas>

      {/* UI Overlay: 타이틀 */}
      <div className="absolute top-5 left-5 z-10 pointer-events-none">
        <h1 className="text-white text-2xl font-bold drop-shadow-lg">My Muuvi Universe</h1>
        <p className="text-white/70 text-sm">당신의 취향이 별이 되어 빛나는 곳</p>
      </div>

      {/* UI Overlay: 뒤로가기 버튼 */}
      <button
        onClick={() => navigate('/main')}
        className="absolute top-5 right-5 z-10 w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* UI Overlay: 선택된 영화 상세 카드 (하단 팝업) */}
      {selectedContent && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 animate-fade-in-up">
          <div className="relative">
            {/* 닫기 버튼 */}
            <button
              onClick={() => handleBackgroundClick()}
              className="absolute -top-3 -right-3 z-30 bg-white text-black rounded-full p-1 shadow-lg"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
            {/* 기존 RecommendationCard 재사용 (클릭 시 상세 페이지 이동 기능 포함됨) */}
            <RecommendationCard content={selectedContent} isActive={true} />
          </div>
        </div>
      )}

      {/* 애니메이션 스타일 (tailwind.config.js에 없다면 인라인으로 대체 가능) */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  )
}

