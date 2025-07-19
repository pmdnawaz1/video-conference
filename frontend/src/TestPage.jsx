import React from 'react';

// Simple test page to verify Tailwind CSS is working
const TestPage = () => {
  return (
    <div className="min-h-screen bg-blue-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-blue-900 mb-8">Tailwind CSS v4 Test</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Test Card 1 */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Colors Test</h2>
            <div className="space-y-2">
              <div className="bg-red-500 text-white p-2 rounded">Red</div>
              <div className="bg-green-500 text-white p-2 rounded">Green</div>
              <div className="bg-blue-500 text-white p-2 rounded">Blue</div>
            </div>
          </div>

          {/* Test Card 2 */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Buttons Test</h2>
            <div className="space-y-2">
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                Primary Button
              </button>
              <button className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded">
                Secondary Button
              </button>
            </div>
          </div>

          {/* Test Card 3 */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Form Test</h2>
            <div className="space-y-2">
              <input 
                type="text" 
                placeholder="Test input"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea 
                placeholder="Test textarea"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
              />
            </div>
          </div>
        </div>

        {/* Video Element Test */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Video Element Test</h2>
          <div className="bg-gray-800 rounded-lg h-48 flex items-center justify-center">
            <p className="text-white">Video placeholder (480x192)</p>
          </div>
        </div>

        {/* Status */}
        <div className="mt-8 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          ✅ If you can see this styled page, Tailwind CSS v4 is working!
        </div>
      </div>
    </div>
  );
};

export default TestPage;