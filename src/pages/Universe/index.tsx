import { useState, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Billboard, Text } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useNavigate } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import { supabase } from '../../lib/supabase'
import { languageState } from '../../recoil/userState'
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
  if (content.tags && content.tags.length > 0) {
    const firstTag = content.tags[0]
    return firstTag.split('&')[0].trim()
  }
  if (content.genres && content.genres.length > 0) {
    return content.genres[0]
  }
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

  useFrame((state) => {
    if (ref.current) {
      const t = state.clock.getElapsedTime()
      const scale = isSelected ? 1.5 : hovered ? 1.2 : 1 + Math.sin(t * 2 + position[0]) * 0.2
      ref.current.scale.setScalar(scale)
    }
  })

  return (
    <group position={position}>
      <mesh
        ref={ref}
        onClick={(e) => {
          e.stopPropagation()
          onClick(content, position)
        }}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected || hovered ? 3 : 0.8}
          toneMapped={false}
        />
      </mesh>

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

// UI 텍스트 번역
const UNIVERSE_TEXT = {
  ko: {
    title: 'My Muuvi Universe',
    subtitle: '당신의 취향이 별이 되어 빛나는 곳',
  },
  en: {
    title: 'My Muuvi Universe',
    subtitle: 'Where your preferences shine as stars',
  },
}

export default function Universe() {
  const navigate = useNavigate()
  const language = useRecoilValue(languageState)
  const t = UNIVERSE_TEXT[language]
  const [contents, setContents] = useState<Content[]>([])
  const [selectedContent, setSelectedContent] = useState<Content | null>(null)
  const [targetPosition, setTargetPosition] = useState<[number, number, number] | null>(null)

  useEffect(() => {
    const fetchContents = async () => {
      try {
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

  const stars = useMemo(() => {
    return contents.map((content) => {
      const genre = getPrimaryGenre(content)
      const center = GENRE_CLUSTERS[genre] || GENRE_CLUSTERS['default']

      const spread = 5
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

  const mainGenres = useMemo(() => {
    const mainGenreList: string[] = []
    const genreKeys = Object.keys(GENRE_CLUSTERS).filter((g) => g !== 'default')
    const seenCoords = new Set<string>()
    
    for (const genre of genreKeys) {
      const coords = JSON.stringify(GENRE_CLUSTERS[genre])
      if (!seenCoords.has(coords)) {
        seenCoords.add(coords)
        if (language === 'ko') {
          if (/[가-힣]/.test(genre)) {
            mainGenreList.push(genre)
          } else if (!genreKeys.some((g) => g !== genre && JSON.stringify(GENRE_CLUSTERS[g]) === coords && /[가-힣]/.test(g))) {
            mainGenreList.push(genre)
          }
        } else {
          if (!/[가-힣]/.test(genre)) {
            mainGenreList.push(genre)
          } else if (!genreKeys.some((g) => g !== genre && JSON.stringify(GENRE_CLUSTERS[g]) === coords && !/[가-힣]/.test(g))) {
            mainGenreList.push(genre)
          }
        }
      }
    }
    
    return mainGenreList.slice(0, 8)
  }, [language])

  return (
    <div className="w-full h-screen bg-black relative overflow-hidden font-pretendard">
      <Canvas camera={{ position: [0, 0, 25], fov: 60 }}>
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.08}
            luminanceSmoothing={0.9}
            intensity={4.5}
            mipmapBlur={true}
          />
        </EffectComposer>
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
        <CameraController target={targetPosition} />
        <mesh
          visible={false}
          onClick={handleBackgroundClick}
          scale={[100, 100, 100]}
        >
          <sphereGeometry />
        </mesh>
      </Canvas>
      <div className="absolute top-0 left-0 right-0 z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none" />
        <div className="relative px-6 py-4">
          <div className="flex items-start justify-between mb-4">
            <div className="pointer-events-none">
              <h1 className="text-white text-2xl font-bold drop-shadow-lg mb-1">{t.title}</h1>
              <p className="text-white/60 text-xs">{t.subtitle}</p>
            </div>
            <button
              onClick={() => navigate('/main')}
              className="w-9 h-9 bg-white/5 backdrop-blur-xl rounded-full flex items-center justify-center text-white hover:bg-white/15 transition-all duration-300 border border-white/10 hover:border-white/30 hover:scale-110"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex flex-wrap gap-2 justify-start">
            {mainGenres.map((genre, index) => (
              <button
                key={genre}
                onClick={() => {
                  setSelectedContent(null)
                  setTargetPosition(GENRE_CLUSTERS[genre] as [number, number, number])
                }}
                className="group relative px-4 py-2 bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-xl rounded-full text-white text-sm font-medium hover:from-white/15 hover:to-white/20 transition-all duration-300 border border-white/10 hover:border-white/30 hover:scale-105 hover:shadow-lg overflow-hidden"
                style={{ 
                  animationDelay: `${index * 50}ms`,
                }}
              >
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${GENRE_COLORS[genre] || '#ffffff'}40, ${GENRE_COLORS[genre] || '#ffffff'}20)`
                  }}
                />
                <div 
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                  style={{ 
                    backgroundColor: GENRE_COLORS[genre] || '#ffffff',
                    boxShadow: `0 0 8px ${GENRE_COLORS[genre] || '#ffffff'}80`
                  }}
                />
                <span className="relative pl-3">{genre}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {selectedContent && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 animate-fade-in-up">
          <div className="relative">
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
            <RecommendationCard content={selectedContent} isActive={true} />
          </div>
        </div>
      )}
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

