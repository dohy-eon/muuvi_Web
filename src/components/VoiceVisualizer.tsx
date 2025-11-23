import { useEffect, useRef } from 'react'

interface VoiceVisualizerProps {
  stream: MediaStream | null
  isListening: boolean
}

export default function VoiceVisualizer({ stream, isListening }: VoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    if (!stream || !isListening || !canvasRef.current) return

    // AudioContext 설정
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    const audioCtx = audioContextRef.current
    
    // Analyser 설정
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    analyserRef.current = analyser

    // 마이크 소스 연결
    const source = audioCtx.createMediaStreamSource(stream)
    source.connect(analyser)
    sourceRef.current = source

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    // 그리기 함수 (애니메이션 루프)
    const draw = () => {
      if (!isListening) return
      
      animationRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataArray)

      ctx.fillStyle = '#ffffff' // 배경색 (흰색)
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // 파형 스타일 설정
      const barWidth = (canvas.width / bufferLength) * 2.5
      let barHeight
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 1.5 // 높이 조절

        // 그라데이션 색상 (Muuvi 브랜드 컬러: 보라 -> 핑크)
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
        gradient.addColorStop(0, '#2e2c6a')
        gradient.addColorStop(1, '#9b59b6')
        
        ctx.fillStyle = gradient
        
        // 둥근 막대 그리기 (roundRect가 지원되지 않을 경우를 대비)
        ctx.beginPath()
        const y = (canvas.height - barHeight) / 2 // 중앙 정렬
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, 50)
        } else {
          // 폴백: 일반 사각형
          ctx.rect(x, y, barWidth, barHeight)
        }
        ctx.fill()

        x += barWidth + 2 // 간격
      }
    }

    draw()

    return () => {
      cancelAnimationFrame(animationRef.current)
      if (sourceRef.current) sourceRef.current.disconnect()
      // AudioContext는 재사용을 위해 닫지 않거나 필요시 close()
    }
  }, [stream, isListening])

  return (
    <div className="w-full h-40 flex items-center justify-center bg-white rounded-2xl shadow-inner overflow-hidden">
      <canvas 
        ref={canvasRef} 
        width={300} 
        height={160} 
        className="w-full h-full"
      />
    </div>
  )
}

