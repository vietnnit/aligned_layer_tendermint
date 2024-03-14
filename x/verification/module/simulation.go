package verification

import (
	"math/rand"

	sdk "github.com/cosmos/cosmos-sdk/types"
	"github.com/cosmos/cosmos-sdk/types/module"
	simtypes "github.com/cosmos/cosmos-sdk/types/simulation"
	"github.com/cosmos/cosmos-sdk/x/simulation"

	"alignedlayer/testutil/sample"
	verificationsimulation "alignedlayer/x/verification/simulation"
	"alignedlayer/x/verification/types"
)

// avoid unused import issue
var (
	_ = verificationsimulation.FindAccount
	_ = rand.Rand{}
	_ = sample.AccAddress
	_ = sdk.AccAddress{}
	_ = simulation.MsgEntryKind
)

const (
	opWeightMsgVerify = "op_weight_msg_verify"
	// TODO: Determine the simulation weight value
	defaultWeightMsgVerify int = 100

	opWeightMsgVerifySp1 = "op_weight_msg_verify_sp_1"
	// TODO: Determine the simulation weight value
	defaultWeightMsgVerifySp1 int = 100

	opWeightMsgVerifycairo = "op_weight_msg_verifycairo"
	// TODO: Determine the simulation weight value
	defaultWeightMsgVerifycairo int = 100

	// this line is used by starport scaffolding # simapp/module/const
)

// GenerateGenesisState creates a randomized GenState of the module.
func (AppModule) GenerateGenesisState(simState *module.SimulationState) {
	accs := make([]string, len(simState.Accounts))
	for i, acc := range simState.Accounts {
		accs[i] = acc.Address.String()
	}
	verificationGenesis := types.GenesisState{
		Params: types.DefaultParams(),
		// this line is used by starport scaffolding # simapp/module/genesisState
	}
	simState.GenState[types.ModuleName] = simState.Cdc.MustMarshalJSON(&verificationGenesis)
}

// RegisterStoreDecoder registers a decoder.
func (am AppModule) RegisterStoreDecoder(_ simtypes.StoreDecoderRegistry) {}

// ProposalContents doesn't return any content functions for governance proposals.
func (AppModule) ProposalContents(_ module.SimulationState) []simtypes.WeightedProposalContent {
	return nil
}

// WeightedOperations returns the all the gov module operations with their respective weights.
func (am AppModule) WeightedOperations(simState module.SimulationState) []simtypes.WeightedOperation {
	operations := make([]simtypes.WeightedOperation, 0)

	var weightMsgVerify int
	simState.AppParams.GetOrGenerate(opWeightMsgVerify, &weightMsgVerify, nil,
		func(_ *rand.Rand) {
			weightMsgVerify = defaultWeightMsgVerify
		},
	)
	operations = append(operations, simulation.NewWeightedOperation(
		weightMsgVerify,
		verificationsimulation.SimulateMsgVerify(am.accountKeeper, am.bankKeeper, am.keeper),
	))

	var weightMsgVerifySp1 int
	simState.AppParams.GetOrGenerate(opWeightMsgVerifySp1, &weightMsgVerifySp1, nil,
		func(_ *rand.Rand) {
			weightMsgVerifySp1 = defaultWeightMsgVerifySp1
		},
	)
	operations = append(operations, simulation.NewWeightedOperation(
		weightMsgVerifySp1,
		verificationsimulation.SimulateMsgVerifySp1(am.accountKeeper, am.bankKeeper, am.keeper),
	))

	var weightMsgVerifycairo int
	simState.AppParams.GetOrGenerate(opWeightMsgVerifycairo, &weightMsgVerifycairo, nil,
		func(_ *rand.Rand) {
			weightMsgVerifycairo = defaultWeightMsgVerifycairo
		},
	)
	operations = append(operations, simulation.NewWeightedOperation(
		weightMsgVerifycairo,
		verificationsimulation.SimulateMsgVerifycairo(am.accountKeeper, am.bankKeeper, am.keeper),
	))

	// this line is used by starport scaffolding # simapp/module/operation

	return operations
}

// ProposalMsgs returns msgs used for governance proposals for simulations.
func (am AppModule) ProposalMsgs(simState module.SimulationState) []simtypes.WeightedProposalMsg {
	return []simtypes.WeightedProposalMsg{
		simulation.NewWeightedProposalMsg(
			opWeightMsgVerify,
			defaultWeightMsgVerify,
			func(r *rand.Rand, ctx sdk.Context, accs []simtypes.Account) sdk.Msg {
				verificationsimulation.SimulateMsgVerify(am.accountKeeper, am.bankKeeper, am.keeper)
				return nil
			},
		),
		simulation.NewWeightedProposalMsg(
			opWeightMsgVerifySp1,
			defaultWeightMsgVerifySp1,
			func(r *rand.Rand, ctx sdk.Context, accs []simtypes.Account) sdk.Msg {
				verificationsimulation.SimulateMsgVerifySp1(am.accountKeeper, am.bankKeeper, am.keeper)
				return nil
			},
		),
		simulation.NewWeightedProposalMsg(
			opWeightMsgVerifycairo,
			defaultWeightMsgVerifycairo,
			func(r *rand.Rand, ctx sdk.Context, accs []simtypes.Account) sdk.Msg {
				verificationsimulation.SimulateMsgVerifycairo(am.accountKeeper, am.bankKeeper, am.keeper)
				return nil
			},
		),
		// this line is used by starport scaffolding # simapp/module/OpMsg
	}
}
