              {/* Todos los tiers / requisitos */}
              <div className="mb-6">
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-3">Variantes de descuentos</h4>
                <div className="space-y-3">
                  {selectedPromo.requirements.map((r, idx) => {
                    // Helper para obtener el label del descuento
                    const getDiscountLabel = () => {
                      if (r.discountType === 'CUOTAS_SIN_INTERES') return `${r.discountValue} cuotas`
                      return `${r.discountValue}%`
                    }

                    // Helper para el subtipo
                    const getDiscountSubtype = () => {
                      if (r.discountType === 'CUOTAS_SIN_INTERES') return 'Sin interés'
                      return r.discountType === 'PERCENTAGE_REINTEGRO' ? 'Reintegro' : 'Directo'
                    }

                    return (
                      <div key={idx} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center justify-between group hover:border-indigo-200 transition-colors">
                        <div className="flex-1 min-w-0 pr-4">
                          {/* Banco/Wallet con tooltip */}
                          <div className="relative group/bank inline-block">
                            <p className="font-bold text-gray-900 text-sm flex items-center gap-2">
                              <span className="flex items-center gap-1.5">
                                {r.bank && <span className="text-xs">🏦</span>}
                                {r.wallet && !r.bank && <span className="text-xs">📱</span>}
                                {r.bank?.name || r.wallet?.name || 'Cualquier entidad'}
                              </span>
                              {r.segment && <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] uppercase tracking-wider rounded-md">{r.segment}</span>}
                            </p>
                            
                            {/* Tooltip para banco/wallet */}
                            {(r.bank || r.wallet) && (
                              <div className="absolute left-0 top-full mt-1 hidden group-hover/bank:block z-50 w-max">
                                <div className="bg-gray-900 text-white text-[10px] px-3 py-2 rounded-lg shadow-lg">
                                  <div className="font-bold mb-1">{r.bank?.name || r.wallet?.name}</div>
                                  <div className="text-gray-300">
                                    {r.bank && 'Banco emisor'}
                                    {r.wallet && !r.bank && 'Billetera digital'}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Tarjeta con tooltips individuales */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                            {/* Red de tarjeta con tooltip */}
                            <div className="relative group/network inline-block">
                              <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1 cursor-help">
                                {r.cardNetwork?.name === 'Visa' && <span className="text-blue-600">💳</span>}
                                {r.cardNetwork?.name === 'Mastercard' && <span className="text-red-600">💳</span>}
                                {r.cardNetwork?.name === 'American Express' && <span className="text-blue-400">💳</span>}
                                {!r.cardNetwork && <span className="text-gray-400">💳</span>}
                                {r.cardNetwork?.name || 'Cualquier tarjeta'}
                              </span>
                              
                              {/* Tooltip para red */}
                              {r.cardNetwork && (
                                <div className="absolute left-0 top-full mt-1 hidden group-hover/network:block z-50 w-max">
                                  <div className="bg-gray-900 text-white text-[10px] px-3 py-2 rounded-lg shadow-lg">
                                    <div className="font-bold mb-1">{r.cardNetwork.name}</div>
                                    <div className="text-gray-300">Red de tarjeta</div>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            <span className="text-[10px] text-gray-300">•</span>
                            
                            {/* Tipo de tarjeta con tooltip */}
                            <div className="relative group/type inline-block">
                              <span className="text-[10px] text-gray-500 font-medium cursor-help">
                                {r.cardType === 'CREDIT' ? '💰 Crédito' : r.cardType === 'DEBIT' ? '🏧 Débito' : r.cardType === 'PREPAID' ? '🎟️ Prepaga' : 'Cualquier tipo'}
                              </span>
                              
                              {/* Tooltip para tipo */}
                              {r.cardType && (
                                <div className="absolute left-0 top-full mt-1 hidden group-hover/type:block z-50 w-max">
                                  <div className="bg-gray-900 text-white text-[10px] px-3 py-2 rounded-lg shadow-lg">
                                    <div className="font-bold mb-1">
                                      {r.cardType === 'CREDIT' ? 'Tarjeta de Crédito' : r.cardType === 'DEBIT' ? 'Tarjeta de Débito' : 'Tarjeta Prepaga'}
                                    </div>
                                    <div className="text-gray-300">Tipo de tarjeta requerida</div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Payment channel */}
                            {r.paymentChannel && r.paymentChannel !== 'ANY' && (
                              <>
                                <span className="text-[10px] text-gray-300">•</span>
                                <div className="relative group/channel inline-block">
                                  <span className="text-[10px] text-gray-500 font-medium cursor-help">
                                    {r.paymentChannel === 'PHYSICAL' ? '💳 Física' : '📱 Digital'}
                                  </span>
                                  
                                  {/* Tooltip para canal */}
                                  <div className="absolute left-0 top-full mt-1 hidden group-hover/channel:block z-50 w-max">
                                    <div className="bg-gray-900 text-white text-[10px] px-3 py-2 rounded-lg shadow-lg">
                                      <div className="font-bold mb-1">
                                        {r.paymentChannel === 'PHYSICAL' ? 'Tarjeta Física' : 'Tarjeta Digital'}
                                      </div>
                                      <div className="text-gray-300">
                                        {r.paymentChannel === 'PHYSICAL' ? 'Requiere tarjeta plástica' : 'Admite tarjeta virtual'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                          
                          {r.note && <p className="text-[10px] text-indigo-500 font-bold mt-1.5 uppercase leading-none">⚠️ {r.note}</p>}
                        </div>
                        
                        {/* Descuento */}
                        <div className="text-right shrink-0">
                          <p className="text-lg font-extrabold text-indigo-600">{getDiscountLabel()}</p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{getDiscountSubtype()}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
