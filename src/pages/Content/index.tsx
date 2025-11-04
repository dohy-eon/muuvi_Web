import React from 'react'
import { useParams } from 'react-router-dom'

export default function Content() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">콘텐츠</h1>
        <p className="text-center text-gray-600">콘텐츠 ID: {id}</p>
      </div>
    </div>
  )
}
